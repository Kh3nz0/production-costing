import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';

/**
 * S7's database half: a pricing snapshot records what a price assumed, and
 * nothing can change it afterwards. If it could, it would answer "what did we
 * assume in September?" with today's assumptions, which is the one thing it
 * exists not to do.
 */

let t: TestDb;
let owner: string;
let outsider: string;
let org: string;
let product: string;
let channel: string;

async function snapshot(margin = '0.4'): Promise<string> {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ save_pricing_snapshot: string }>(
      `select public.save_pricing_snapshot($1,$2,92.93,80.58,$3,0.48,16654,8665,9992,
         '{"fee_rate":"0.07"}'::jsonb,'Shopee at 7%')`,
      [product, channel, margin],
    );
    return r.rows[0]!.save_pricing_snapshot;
  });
}

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('pricing-owner@example.test');
  outsider = await t.createUser('pricing-outsider@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Pricing test')",
    );
    return r.rows[0]!.create_organization;
  });
  const piece = (
    await t.db.query<{ id: string }>(
      "select id from public.units where code='pc' and org_id is null",
    )
  ).rows[0]!.id;
  product = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_product: string }>(
      'select public.create_product($1,$2,$3,$4,$5)',
      [org, 'Clickable Keychain', 'KEY-S7', piece, '0.05'],
    );
    return r.rows[0]!.create_product;
  });
  channel = await t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.sales_channels(org_id,name,created_by) values($1,'Shopee',$2) returning id`,
      [org, owner],
    );
    return r.rows[0]!.id;
  });
});
afterAll(async () => t.close());

describe('a pricing snapshot', () => {
  it('records both costs, the price and both break-evens', async () => {
    const id = await snapshot();
    await t.asUser(owner, async () => {
      const r = await t.db.query<{
        pricing_unit_cost: string;
        inventory_unit_cost: string;
        list_price_cents: string | number;
        break_even_contribution_cents: string | number;
        break_even_overhead_cents: string | number;
        inputs: { fee_rate: string };
      }>(
        `select pricing_unit_cost,inventory_unit_cost,list_price_cents,
                break_even_contribution_cents,break_even_overhead_cents,inputs
         from public.pricing_snapshots where id=$1`,
        [id],
      );
      const row = r.rows[0]!;
      // PGlite hands back a bigint column as a JS number; over PostgREST the
      // app asks for ::text. Compare as text either way.
      // Both costs, because a price is built on one and measured against the other.
      expect(row.pricing_unit_cost).toBe('92.93000000');
      expect(row.inventory_unit_cost).toBe('80.58000000');
      expect(String(row.list_price_cents)).toBe('16654');
      expect(String(row.break_even_contribution_cents)).toBe('8665');
      expect(String(row.break_even_overhead_cents)).toBe('9992');
      // The channel's terms by value: an id alone would not survive the fee
      // version being superseded, which is when the question gets asked.
      expect(row.inputs.fee_rate).toBe('0.07');
    });
  });

  it('cannot be edited or deleted, by anyone, ever', async () => {
    const id = await snapshot();
    await t.asUser(owner, async () => {
      // Refused at the grant, before RLS is even consulted: the table has
      // select and nothing else. An RLS-only refusal would report success
      // having changed zero rows, which is the failure F-37 was raised for.
      await expect(
        t.db.query('update public.pricing_snapshots set list_price_cents=1 where id=$1', [id]),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        t.db.query('delete from public.pricing_snapshots where id=$1', [id]),
      ).rejects.toThrow(/permission denied/i);
      // Still there, still saying what it said.
      const r = await t.db.query<{ list_price_cents: string | number }>(
        'select list_price_cents from public.pricing_snapshots where id=$1',
        [id],
      );
      expect(String(r.rows[0]!.list_price_cents)).toBe('16654');
    });
  });

  it('cannot be written by hand, only by the function', async () => {
    await t.asUser(owner, async () => {
      await expect(
        t.db.query(
          `insert into public.pricing_snapshots
             (org_id,item_id,pricing_unit_cost,inventory_unit_cost,target_margin,
              list_price_cents,break_even_contribution_cents,break_even_overhead_cents,created_by)
           values ($1,$2,1,1,0.4,100,100,100,$3)`,
          [org, product, owner],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a margin of 100% with the reason', async () => {
    await t.asUser(owner, async () => {
      await expect(snapshot('1')).rejects.toThrow(/infinite price/i);
    });
  });

  it('is invisible to another tenant', async () => {
    await snapshot();
    await t.asUser(outsider, async () => {
      const r = await t.db.query('select id from public.pricing_snapshots');
      expect(r.rows).toHaveLength(0);
    });
    await t.asUser(outsider, async () => {
      await expect(
        t.db.query(`select public.save_pricing_snapshot($1,null,1,1,0.4,0.4,100,100,100)`, [
          product,
        ]),
      ).rejects.toThrow(/permission/i);
    });
  });
});

describe('the target margin', () => {
  it('saves through its function and refuses 100%', async () => {
    await t.asUser(owner, async () => {
      await t.db.query('select public.save_product_pricing($1,0.4)', [product]);
      const r = await t.db.query<{ target_margin: string }>(
        'select target_margin from public.product_details where item_id=$1',
        [product],
      );
      expect(r.rows[0]!.target_margin).toBe('0.400000');
      await expect(
        t.db.query('select public.save_product_pricing($1,1)', [product]),
      ).rejects.toThrow(/infinite price/i);
    });
  });
});
