import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';

/**
 * S9's done-when: the F-13 example reproduces ₱15.12 and 15.7%; fees stored as
 * amounts survive a channel rate change; uncosted stock is blocked and the
 * override flags `cost_source = 'estimate'`.
 */

let t: TestDb;
let owner: string;
let org: string;
let piece: string;
let product: string;
let channel: string;

async function sale(id: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{
      revenue_cents: string;
      cogs_cents: string | null;
      gross_profit_cents: string | null;
      net_revenue_cents: string;
      contribution_profit_cents: string | null;
      commission_fee_cents: string;
      payment_fee_cents: string;
      cost_source: string;
    }>('select * from public.sales where id=$1', [id]);
    return r.rows[0]!;
  });
}

async function balance(id: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ qty_on_hand: string; avg_unit_cost: string | null }>(
      'select qty_on_hand,avg_unit_cost from public.items where id=$1',
      [id],
    );
    return r.rows[0]!;
  });
}

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('sales-owner@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Bloop sales')",
    );
    return r.rows[0]!.create_organization;
  });
  piece = (
    await t.db.query<{ id: string }>(
      "select id from public.units where code='pc' and org_id is null",
    )
  ).rows[0]!.id;

  product = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_product: string }>(
      'select public.create_product($1,$2,$3,$4,$5)',
      [org, 'Clickable Keychain', 'KEY-S9', piece, '0.05'],
    );
    return r.rows[0]!.create_product;
  });
  // Ten units on the shelf at exactly the F-13 cost.
  await t.asUser(owner, async () => {
    await t.db.query(`select public.record_opening_balance($1,10,81.48,'2026-09-01')`, [product]);
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

describe('F-13, the worked example', () => {
  let id: string;

  it('records the sale and takes the units out of stock', async () => {
    id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ record_sale: string }>('select public.record_sale($1,$2)', [
        JSON.stringify({
          org_id: org,
          sale_date: '2026-09-20',
          channel_id: channel,
          reference_no: 'SHP-0001',
          commission_fee_cents: 600,
          payment_fee_cents: 240,
          shipping_charged_cents: 5000,
          shipping_cost_cents: 6500,
          payment_status: 'paid',
        }),
        JSON.stringify([{ item_id: product, quantity: '1', unit_price_cents: 12000 }]),
      ]);
      return r.rows[0]!.record_sale;
    });

    const after = await balance(product);
    expect(toDecimal(after.qty_on_hand).toFixed(0)).toBe('9');
    // A sale does not change what the remaining stock cost.
    expect(toDecimal(after.avg_unit_cost!).toFixed(2)).toBe('81.48');
  });

  it('reproduces ₱15.12 of contribution on ₱96.60 of net revenue', async () => {
    const row = await sale(id);
    expect(Money.fromCentavos(BigInt(row.revenue_cents)).format()).toBe('₱120.00');
    expect(Money.fromCentavos(BigInt(row.cogs_cents!)).format()).toBe('₱81.48');
    expect(Money.fromCentavos(BigInt(row.gross_profit_cents!)).format()).toBe('₱38.52');
    expect(Money.fromCentavos(BigInt(row.net_revenue_cents)).format()).toBe('₱96.60');
    expect(Money.fromCentavos(BigInt(row.contribution_profit_cents!)).format()).toBe('₱15.12');
    expect(row.cost_source).toBe('actual');
  });

  it('keeps its fees when the channel rate changes afterwards', async () => {
    const before = await sale(id);
    await t.asUser(owner, async () => {
      await t.db.query(
        `insert into public.channel_fee_versions
           (org_id,channel_id,effective_from,commission_rate,payment_rate,created_by)
         values($1,$2,'2026-09-01',0.25,0.10,$3)`,
        [org, channel, owner],
      );
    });
    const after = await sale(id);
    // Stored as amounts, so a rate five times larger cannot reach back.
    expect(after.commission_fee_cents).toBe(before.commission_fee_cents);
    expect(after.payment_fee_cents).toBe(before.payment_fee_cents);
    expect(after.contribution_profit_cents).toBe(before.contribution_profit_cents);
  });

  it('wrote the cost onto the line rather than leaving it to be recomputed', async () => {
    // The cost of goods is not derived on read from whatever the item costs
    // today: it is the average that was in force when the units left, written
    // onto the line. Later movements cannot reach it.
    const line = await t.asUser(owner, async () => {
      const r = await t.db.query<{ unit_cogs: string; line_cogs_cents: string }>(
        'select unit_cogs,line_cogs_cents from public.sale_lines where sale_id=$1',
        [id],
      );
      return r.rows[0]!;
    });
    expect(toDecimal(line.unit_cogs).toFixed(2)).toBe('81.48');
    expect(Money.fromCentavos(BigInt(line.line_cogs_cents)).format()).toBe('₱81.48');

    const before = await sale(id);
    await t.asUser(owner, async () => {
      await t.db.query(`select public.adjust_stock($1,8,'adjustment','Count','2026-09-21')`, [
        product,
      ]);
    });
    expect((await sale(id)).cogs_cents).toBe(before.cogs_cents);
  });
});

describe('selling stock that has no cost', () => {
  it('records the sale with an unknown cost rather than a zero one', async () => {
    const uncosted = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string }>(
        `insert into public.items(org_id,name,item_type,base_unit_id,created_by)
         values($1,'Uncosted trinket','finished_product',$2,$3) returning id`,
        [org, piece, owner],
      );
      await t.db.query(`select public.record_opening_balance($1,5)`, [r.rows[0]!.id]);
      return r.rows[0]!.id;
    });
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ record_sale: string }>('select public.record_sale($1,$2)', [
        JSON.stringify({ org_id: org }),
        JSON.stringify([{ item_id: uncosted, quantity: '1', unit_price_cents: 10000 }]),
      ]);
      return r.rows[0]!.record_sale;
    });
    const row = await sale(id);
    // Revenue is known; the cost is not, and a null says so where a ₱0.00
    // would have reported the sale as pure profit.
    expect(Money.fromCentavos(BigInt(row.revenue_cents)).format()).toBe('₱100.00');
    expect(row.cogs_cents).toBeNull();
    expect(row.contribution_profit_cents).toBeNull();
  });

  it('accepts a server-computed estimate and flags the sale for correction', async () => {
    const never = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string }>(
        `insert into public.items(org_id,name,item_type,base_unit_id,created_by)
         values($1,'Never produced','finished_product',$2,$3) returning id`,
        [org, piece, owner],
      );
      return r.rows[0]!.id;
    });
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ record_sale: string }>('select public.record_sale($1,$2)', [
        JSON.stringify({ org_id: org }),
        JSON.stringify([
          {
            item_id: never,
            quantity: '2',
            unit_price_cents: 20000,
            estimated_unit_cogs: '80.58',
          },
        ]),
      ]);
      return r.rows[0]!.record_sale;
    });
    const row = await sale(id);
    expect(row.cost_source).toBe('estimate');
    expect(Money.fromCentavos(BigInt(row.cogs_cents!)).format()).toBe('₱161.16');
    // No stock left, because there was none: no movement is written.
    const movements = await t.asUser(owner, async () => {
      const r = await t.db.query('select id from public.inventory_movements where item_id=$1', [
        never,
      ]);
      return r.rows;
    });
    expect(movements).toHaveLength(0);
  });

  it('refuses to sell more than is on the shelf', async () => {
    await t.asUser(owner, async () => {
      await expect(
        t.db.query('select public.record_sale($1,$2)', [
          JSON.stringify({ org_id: org }),
          JSON.stringify([{ item_id: product, quantity: '999', unit_price_cents: 100 }]),
        ]),
      ).rejects.toThrow(/Clickable Keychain/);
    });
  });
});

describe('a sale is a fact about a past event', () => {
  it('cannot have its figures edited by hand, only its status', async () => {
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ record_sale: string }>('select public.record_sale($1,$2)', [
        JSON.stringify({ org_id: org, sale_date: '2026-09-22' }),
        JSON.stringify([{ item_id: product, quantity: '1', unit_price_cents: 15000 }]),
      ]);
      return r.rows[0]!.record_sale;
    });
    await t.asUser(owner, async () => {
      await expect(
        t.db.query('update public.sales set revenue_cents=1 where id=$1', [id]),
      ).rejects.toThrow(/permission denied/i);
      await t.db.query(`select public.set_sale_status($1,'paid','fulfilled')`, [id]);
    });
    const row = await t.asUser(owner, async () => {
      const r = await t.db.query<{ payment_status: string; fulfilment_status: string }>(
        'select payment_status,fulfilment_status from public.sales where id=$1',
        [id],
      );
      return r.rows[0]!;
    });
    expect(row.payment_status).toBe('paid');
    expect(row.fulfilment_status).toBe('fulfilled');
  });
});
