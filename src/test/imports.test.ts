import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';

/**
 * S12's remaining criteria: the four multi-row templates apply, and an applied
 * batch reverses.
 *
 * Each of these is one function and therefore one transaction. The test that
 * matters most is the one where a row fails halfway: nothing at all may be
 * written, because a half-imported purchase is worse than a refused one.
 */

let t: TestDb;
let owner: string;
let org: string;
let gram: string;
let piece: string;
let filament: string;

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('import-owner@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Import test')",
    );
    return r.rows[0]!.create_organization;
  });
  gram = (
    await t.db.query<{ id: string }>(
      "select id from public.units where code='g' and org_id is null",
    )
  ).rows[0]!.id;
  piece = (
    await t.db.query<{ id: string }>(
      "select id from public.units where code='pc' and org_id is null",
    )
  ).rows[0]!.id;
  filament = await t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items(org_id,name,item_type,base_unit_id,purchase_unit_id,
                                purchase_to_base_factor,created_by)
       values($1,'PLA Basic Filament','raw_material',$2,$2,1,$3) returning id`,
      [org, gram, owner],
    );
    return r.rows[0]!.id;
  });
});
afterAll(async () => t.close());

describe('a purchase imports as a header, its lines and a receipt', () => {
  let purchase: string;

  it('creates the header', async () => {
    purchase = await t.asUser(owner, async () => {
      const r = await t.db.query<{ import_purchases: string[] }>(
        'select public.import_purchases($1,$2::jsonb)',
        [
          org,
          JSON.stringify([
            {
              reference_no: 'IMP-001',
              purchase_date: '2026-02-01',
              shipping_cents: 18000,
              landed_cost_base: 'value',
            },
          ]),
        ],
      );
      return r.rows[0]!.import_purchases[0]!;
    });
    expect(purchase).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes the lines and receives them, so the stock lands at a landed cost', async () => {
    await t.asUser(owner, async () => {
      await t.db.query('select public.import_purchase_lines($1,$2::jsonb)', [
        org,
        JSON.stringify([
          {
            purchase_id: purchase,
            item_id: filament,
            qty_ordered: '2000',
            purchase_unit_id: gram,
            unit_price_cents: 100,
          },
        ]),
      ]);
    });
    const item = await t.asUser(owner, async () => {
      const r = await t.db.query<{ qty_on_hand: string; avg_unit_cost: string }>(
        'select qty_on_hand,avg_unit_cost from public.items where id=$1',
        [filament],
      );
      return r.rows[0]!;
    });
    expect(toDecimal(item.qty_on_hand).toFixed(0)).toBe('2000');
    // ₱2,000.00 of goods plus ₱180.00 of shipping over 2,000 g.
    expect(toDecimal(item.avg_unit_cost).toFixed(4)).toBe('1.0900');

    const status = await t.asUser(owner, async () => {
      const r = await t.db.query<{ status: string }>(
        'select status from public.purchases where id=$1',
        [purchase],
      );
      return r.rows[0]!.status;
    });
    expect(status).toBe('received');
  });

  it('writes nothing at all when one line is bad', async () => {
    const before = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        'select count(*)::text as count from public.purchase_lines where org_id=$1',
        [org],
      );
      return r.rows[0]!.count;
    });
    const second = await t.asUser(owner, async () => {
      const r = await t.db.query<{ import_purchases: string[] }>(
        'select public.import_purchases($1,$2::jsonb)',
        [org, JSON.stringify([{ reference_no: 'IMP-002', purchase_date: '2026-02-02' }])],
      );
      return r.rows[0]!.import_purchases[0]!;
    });
    await t.asUser(owner, async () => {
      await expect(
        t.db.query('select public.import_purchase_lines($1,$2::jsonb)', [
          org,
          JSON.stringify([
            {
              purchase_id: second,
              item_id: filament,
              qty_ordered: '100',
              purchase_unit_id: gram,
              unit_price_cents: 100,
            },
            // Second line names no item: the whole import must fail.
            { purchase_id: second, qty_ordered: '5', purchase_unit_id: gram, unit_price_cents: 1 },
          ]),
        ]),
      ).rejects.toThrow();
    });
    const after = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        'select count(*)::text as count from public.purchase_lines where org_id=$1',
        [org],
      );
      return r.rows[0]!.count;
    });
    // Not one line of the good row survived the bad one.
    expect(after).toBe(before);
  });
});

describe('overhead imports as one version for the whole file', () => {
  it('reproduces F-15 from a list of categories', async () => {
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ import_overhead: string }>(
        'select public.import_overhead($1,$2::jsonb,100)',
        [
          org,
          JSON.stringify([
            { category: 'Workspace', amount_cents: 600000, effective_from: '2026-01-01' },
            { category: 'Software subscriptions', amount_cents: 200000 },
            { category: 'Internet', amount_cents: 150000 },
          ]),
        ],
      );
      return r.rows[0]!.import_overhead;
    });
    const version = await t.asUser(owner, async () => {
      const r = await t.db.query<{ monthly_pool_cents: string; rate: string }>(
        'select monthly_pool_cents,rate from public.overhead_versions where id=$1',
        [id],
      );
      return r.rows[0]!;
    });
    // ₱9,500 across 100 hours is ₱95.00, the F-15 figure.
    expect(Money.fromCentavos(BigInt(version.monthly_pool_cents)).format()).toBe('₱9,500.00');
    expect(toDecimal(version.rate).toFixed(2)).toBe('95.00');
  });

  it('treats a category named twice as one category', async () => {
    const before = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        'select count(*)::text as count from public.overhead_categories where org_id=$1',
        [org],
      );
      return r.rows[0]!.count;
    });
    await t.asUser(owner, async () => {
      await t.db.query('select public.import_overhead($1,$2::jsonb,80)', [
        org,
        JSON.stringify([
          { category: 'Workspace', amount_cents: 700000, effective_from: '2026-03-01' },
          { category: 'Internet', amount_cents: 150000 },
        ]),
      ]);
    });
    const after = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        'select count(*)::text as count from public.overhead_categories where org_id=$1',
        [org],
      );
      return r.rows[0]!.count;
    });
    expect(after).toBe(before);
  });

  it('uses the later amount when a category appears twice in one file', async () => {
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ import_overhead: string }>(
        'select public.import_overhead($1,$2::jsonb,100)',
        [
          org,
          JSON.stringify([
            { category: 'Electricity', amount_cents: 10000, effective_from: '2026-04-01' },
            { category: 'electricity', amount_cents: 25000 },
          ]),
        ],
      );
      return r.rows[0]!.import_overhead;
    });
    const lines = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string; amount: string }>(
        `select count(*)::text as count, sum(monthly_amount_cents)::text as amount
         from public.overhead_version_lines where overhead_version_id=$1`,
        [id],
      );
      return r.rows[0]!;
    });
    expect(lines).toEqual({ count: '1', amount: '25000' });
  });
});

describe('recipe lines import as one revision per product', () => {
  it('gathers a product’s lines and saves them through the recipe function', async () => {
    const product = await t.asUser(owner, async () => {
      const r = await t.db.query<{ create_product: string }>(
        'select public.create_product($1,$2,$3,$4,$5)',
        [org, 'Imported Keychain', 'IMP-KEY', piece, '0.05'],
      );
      return r.rows[0]!.create_product;
    });
    await t.asUser(owner, async () => {
      await t.db.query('select public.import_bom_lines($1,$2::jsonb)', [
        org,
        JSON.stringify([
          {
            product_id: product,
            line_type: 'material',
            ref_item_id: filament,
            qty_per_unit: '19.32',
            unit_id: gram,
            waste_rate: '0',
          },
        ]),
      ]);
    });
    const lines = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        `select count(*)::text as count from public.bom_lines l
         join public.boms b on b.id = l.bom_id
         where b.item_id = $1 and b.status = 'active'`,
        [product],
      );
      return r.rows[0]!.count;
    });
    expect(lines).toBe('1');
  });
});

describe('an applied batch reverses', () => {
  it('archives what it created and marks the batch reversed', async () => {
    const created = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string }>(
        `insert into public.suppliers(org_id,name,created_by) values($1,'Imported supplier',$2)
         returning id`,
        [org, owner],
      );
      return r.rows[0]!.id;
    });
    const batch = await t.asUser(owner, async () => {
      const b = await t.db.query<{ id: string }>(
        `insert into public.import_batches(org_id,template_code,status,dry_run,row_count,created_count,created_by)
         values($1,'03-suppliers','applied',false,1,1,$2) returning id`,
        [org, owner],
      );
      await t.db.query(
        `insert into public.import_rows(org_id,batch_id,row_number,raw,status,created_record_id)
         values($1,$2,2,'{}'::jsonb,'created',$3)`,
        [org, b.rows[0]!.id, created],
      );
      return b.rows[0]!.id;
    });

    await t.asUser(owner, async () => {
      await expect(
        t.db.query('select public.reverse_import_batch($1,$2)', [batch, '  ']),
      ).rejects.toThrow(/reason/i);
      const count = await t.db.query<{ reverse_import_batch: number }>(
        'select public.reverse_import_batch($1,$2)',
        [batch, 'Wrong file'],
      );
      expect(count.rows[0]!.reverse_import_batch).toBe(1);
      await expect(
        t.db.query('select public.reverse_import_batch($1,$2)', [batch, 'Again']),
      ).rejects.toThrow(/only an applied import/i);
    });

    const supplier = await t.asUser(owner, async () => {
      const r = await t.db.query<{ archived_at: string | null }>(
        'select archived_at from public.suppliers where id=$1',
        [created],
      );
      return r.rows[0]!;
    });
    expect(supplier.archived_at).not.toBeNull();
  });

  it('refuses to reverse an import that wrote movements or dated versions', async () => {
    const batch = await t.asUser(owner, async () => {
      const b = await t.db.query<{ id: string }>(
        `insert into public.import_batches(org_id,template_code,status,dry_run,row_count,created_count,created_by)
         values($1,'06-opening-stock','applied',false,1,1,$2) returning id`,
        [org, owner],
      );
      await t.db.query(
        `insert into public.import_rows(org_id,batch_id,row_number,raw,status,created_record_id)
         values($1,$2,2,'{}'::jsonb,'created',gen_random_uuid())`,
        [org, b.rows[0]!.id],
      );
      return b.rows[0]!.id;
    });
    await t.asUser(owner, async () => {
      // The ledger is append-only: a movement is undone by a movement, not by
      // deleting it, and the message says so rather than silently doing nothing.
      await expect(
        t.db.query('select public.reverse_import_batch($1,$2)', [batch, 'Mistake']),
      ).rejects.toThrow(/not reversible here/i);
    });
  });
});
