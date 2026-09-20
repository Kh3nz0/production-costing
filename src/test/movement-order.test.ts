import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';

/**
 * D-128. A movement dated behind stock history that already exists is refused,
 * because every movement stores the balance it produced and a past valuation
 * reads that stored balance rather than replaying the ledger.
 */

let t: TestDb;
let owner: string;
let org: string;
let gram: string;

async function newItem(name: string): Promise<string> {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items(org_id,name,item_type,base_unit_id,created_by)
       values($1,$2,'raw_material',$3,$4) returning id`,
      [org, name, gram, owner],
    );
    return r.rows[0]!.id;
  });
}

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('order-owner@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('In order')",
    );
    return r.rows[0]!.create_organization;
  });
  gram = (
    await t.db.query<{ id: string }>(
      "select id from public.units where code='g' and org_id is null",
    )
  ).rows[0]!.id;
});
afterAll(async () => t.close());

describe('a movement dated behind existing history', () => {
  it('is refused, and says what it would have broken', async () => {
    const item = await newItem('Filament in order');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1,2000,2.00,'2026-09-20')`, [item]);
      await expect(
        t.db.query(
          `select public.adjust_stock($1,1500,'adjustment','Back-dated count','2026-01-01')`,
          [item],
        ),
      ).rejects.toThrow(/already has stock movements dated/i);
    });
  });

  it('leaves the past valuation saying what it should', async () => {
    const item = await newItem('Filament checked');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1,2000,2.00,'2026-09-20')`, [item]);
    });
    const january = await t.asUser(owner, async () => {
      const r = await t.db.query<{ quantity: string }>(
        `select quantity from public.inventory_valuation($1,'2026-01-31')
         where item_name='Filament checked'`,
        [org],
      );
      return r.rows[0]!.quantity;
    });
    // Nothing was held in January, and nothing dated January can appear later.
    expect(january).toBe('0');
  });

  it('still accepts a movement on the same day or after', async () => {
    const item = await newItem('Filament later');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1,2000,2.00,'2026-09-20')`, [item]);
      await t.db.query(
        `select public.adjust_stock($1,1900,'adjustment','Same day count','2026-09-20')`,
        [item],
      );
      await t.db.query(
        `select public.adjust_stock($1,1800,'adjustment','Later count','2026-09-21')`,
        [item],
      );
    });
    const rows = await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        'select count(*)::text as count from public.inventory_movements where item_id=$1',
        [item],
      );
      return r.rows[0]!.count;
    });
    expect(rows).toBe('3');
  });
});
