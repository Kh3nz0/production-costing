import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { toDecimal } from '@/lib/decimal';

/**
 * S14: every mutation that touches stock leaves the ledger and the cached
 * balance agreeing.
 *
 * `items.qty_on_hand` and `items.avg_unit_cost` are a cache so an item list does
 * not aggregate the ledger on every read. `rebuild_item_balances` recomputes
 * that cache from the movements. If the two can disagree, every figure in the
 * system is suspect, so this exercises each kind of mutation in turn and checks
 * the invariant after each one — rather than after the last one, which is how a
 * mid-sequence divergence hides.
 */

let t: TestDb;
let owner: string;
let org: string;
let gram: string;
let piece: string;

async function balances() {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string; qty_on_hand: string; avg_unit_cost: string | null }>(
      'select id,qty_on_hand,avg_unit_cost from public.items where org_id=$1 order by id',
      [org],
    );
    return r.rows;
  });
}

/** Rebuild from the ledger and assert nothing moved. */
async function agrees(step: string) {
  const before = await balances();
  await t.asUser(owner, async () => {
    await t.db.query('select public.rebuild_item_balances($1)', [org]);
  });
  const after = await balances();
  expect(after.length, step).toBe(before.length);
  for (const [index, row] of after.entries()) {
    const was = before[index]!;
    expect(toDecimal(row.qty_on_hand).toFixed(6), `${step}: quantity for ${row.id}`).toBe(
      toDecimal(was.qty_on_hand).toFixed(6),
    );
    expect(row.avg_unit_cost === null, `${step}: cost known for ${row.id}`).toBe(
      was.avg_unit_cost === null,
    );
    if (row.avg_unit_cost !== null && was.avg_unit_cost !== null) {
      expect(toDecimal(row.avg_unit_cost).toFixed(8), `${step}: cost for ${row.id}`).toBe(
        toDecimal(was.avg_unit_cost).toFixed(8),
      );
    }
  }
}

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('ledger-owner@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Ledger agreement')",
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
});
afterAll(async () => t.close());

describe('the cache and the ledger agree after every kind of mutation', () => {
  let filament: string;
  let product: string;

  it('after an opening balance', async () => {
    filament = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string }>(
        `insert into public.items(org_id,name,item_type,base_unit_id,purchase_unit_id,
                                  purchase_to_base_factor,created_by)
         values($1,'Filament','raw_material',$2,$2,1,$3) returning id`,
        [org, gram, owner],
      );
      await t.db.query(`select public.record_opening_balance($1,1000,1.00,'2026-01-02')`, [
        r.rows[0]!.id,
      ]);
      return r.rows[0]!.id;
    });
    await agrees('opening balance');
  });

  it('after a purchase receipt', async () => {
    await t.asUser(owner, async () => {
      const p = await t.db.query<{ id: string }>(
        `insert into public.purchases(org_id,purchase_date,supplier_shipping_cents,created_by)
         values($1,'2026-01-03',5000,$2) returning id`,
        [org, owner],
      );
      await t.db.query(
        `insert into public.purchase_lines
           (org_id,purchase_id,item_id,qty_ordered,qty_received,purchase_unit_id,
            unit_price_cents,created_by)
         values($1,$2,$3,2000,2000,$4,300,$5)`,
        [org, p.rows[0]!.id, filament, gram, owner],
      );
      await t.db.query('select public.receive_purchase($1)', [p.rows[0]!.id]);
    });
    await agrees('purchase receipt');
  });

  it('after an adjustment, and after waste', async () => {
    await t.asUser(owner, async () => {
      await t.db.query(
        `select public.adjust_stock($1,2900,'adjustment','Stock count','2026-01-04')`,
        [filament],
      );
    });
    await agrees('adjustment');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.adjust_stock($1,2850,'waste','Purge','2026-01-05')`, [
        filament,
      ]);
    });
    await agrees('waste');
  });

  it('after a production run', async () => {
    product = await t.asUser(owner, async () => {
      const r = await t.db.query<{ create_product: string }>(
        'select public.create_product($1,$2,$3,$4,$5)',
        [org, 'Keychain', 'LEDGER-1', piece, '0.05'],
      );
      await t.db.query('select public.save_product_recipe($1,$2::jsonb,null)', [
        r.rows[0]!.create_product,
        JSON.stringify([
          {
            line_type: 'material',
            ref_item_id: filament,
            qty_per_unit: '20',
            unit_id: gram,
            waste_rate: '0',
          },
        ]),
      ]);
      return r.rows[0]!.create_product;
    });
    await t.asUser(owner, async () => {
      const run = await t.db.query<{ start_production_run: string }>(
        'select public.start_production_run($1,10,null,null,$2)',
        [product, '2026-01-06'],
      );
      await t.db.query('select public.complete_production_run($1,null,9,2)', [
        run.rows[0]!.start_production_run,
      ]);
    });
    await agrees('production run');
  });

  it('after a sale', async () => {
    await t.asUser(owner, async () => {
      await t.db.query('select public.record_sale($1,$2)', [
        JSON.stringify({ org_id: org, sale_date: '2026-01-07' }),
        JSON.stringify([{ item_id: product, quantity: '3', unit_price_cents: 20000 }]),
      ]);
    });
    await agrees('sale');
  });

  it('after a run is reversed', async () => {
    const run = await t.asUser(owner, async () => {
      const r = await t.db.query<{ start_production_run: string }>(
        'select public.start_production_run($1,2,null,null,$2)',
        [product, '2026-01-08'],
      );
      await t.db.query('select public.complete_production_run($1,null,2,0)', [
        r.rows[0]!.start_production_run,
      ]);
      return r.rows[0]!.start_production_run;
    });
    await agrees('run before reversal');
    await t.asUser(owner, async () => {
      await t.db.query('select public.reverse_production_run($1,$2)', [run, 'Wrong batch']);
    });
    await agrees('run reversal');
  });

  it('leaves every movement carrying the balance it produced', async () => {
    // The invariant underneath all of the above: valuation as of a past date is
    // a lookup of a stored figure, so every row has to carry one.
    const rows = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        `select count(*)::text as count from public.inventory_movements
         where org_id=$1 and resulting_qty is null`,
        [org],
      );
      return r.rows[0]!.count;
    });
    expect(rows).toBe('0');
  });
});
