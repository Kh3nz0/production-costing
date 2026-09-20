import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';

/**
 * F-60. Every mutating RPC must refuse somebody who belongs to no organisation.
 *
 * The guard used to read `my_role(org) not in ('owner','manager','inventory')`,
 * and `my_role` returns NULL for a non-member. `NULL not in (...)` is NULL, so
 * the `if` never fired and the function did the work. RLS does not stand behind
 * these: they are `security definer` so they can write `inventory_movements`,
 * which by D-115 has no insert policy at all.
 *
 * This is a sweep rather than a handful of cases, because the hole was in a
 * pattern rather than in one function, and the pattern is easy to copy into the
 * next one.
 */

let t: TestDb;
let owner: string;
let outsider: string;
let org: string;
let item: string;
let purchase: string;

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('guards-owner@example.test');
  outsider = await t.createUser('guards-outsider@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Guarded')",
    );
    return r.rows[0]!.create_organization;
  });
  const piece = (
    await t.db.query<{ id: string }>(
      "select id from public.units where code='pc' and org_id is null",
    )
  ).rows[0]!.id;
  item = await t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items(org_id,name,item_type,base_unit_id,created_by)
       values($1,'Guarded item','purchased_component',$2,$3) returning id`,
      [org, piece, owner],
    );
    return r.rows[0]!.id;
  });
  purchase = await t.asUser(owner, async () => {
    const p = await t.db.query<{ id: string }>(
      `insert into public.purchases(org_id,purchase_date,created_by)
       values($1,'2026-09-20',$2) returning id`,
      [org, owner],
    );
    await t.db.query(
      `insert into public.purchase_lines
         (org_id,purchase_id,item_id,qty_ordered,qty_received,purchase_unit_id,unit_price_cents,created_by)
       values($1,$2,$3,1,1,$4,100,$5)`,
      [org, p.rows[0]!.id, item, piece, owner],
    );
    return p.rows[0]!.id;
  });
});
afterAll(async () => t.close());

describe('a user who belongs to no organisation', () => {
  const attempts: ReadonlyArray<readonly [string, () => string]> = [
    ['record_opening_balance', () => `select public.record_opening_balance('${item}', 99, 9)`],
    ['adjust_stock', () => `select public.adjust_stock('${item}', 5, 'adjustment', 'outsider')`],
    ['receive_purchase', () => `select public.receive_purchase('${purchase}')`],
    ['rebuild_item_balances', () => `select public.rebuild_item_balances('${org}')`],
  ];

  for (const [name, sql] of attempts) {
    it(`is refused by ${name}`, async () => {
      await t.asUser(outsider, async () => {
        await expect(t.db.query(sql())).rejects.toThrow(/permission/i);
      });
    });
  }

  it('leaves no movement behind', async () => {
    await t.asUser(owner, async () => {
      const r = await t.db.query<{ count: string }>(
        'select count(*)::text as count from public.inventory_movements where item_id=$1',
        [item],
      );
      expect(r.rows[0]!.count).toBe('0');
    });
  });
});
