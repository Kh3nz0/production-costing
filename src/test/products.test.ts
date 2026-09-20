import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';

let t: TestDb;
let owner: string;
let outsider: string;
let org: string;
let piece: string;
let product: string;
let component: string;

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('product-owner@example.test');
  outsider = await t.createUser('product-outsider@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Products test')",
    );
    return r.rows[0]!.create_organization;
  });
  const r = await t.db.query<{ id: string }>(
    "select id from public.units where code='pc' and org_id is null",
  );
  piece = r.rows[0]!.id;
  product = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_product: string }>(
      'select public.create_product($1,$2,$3,$4,$5)',
      [org, 'Keychain', 'KEY-1', piece, '0.05'],
    );
    return r.rows[0]!.create_product;
  });
  component = await t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items(org_id,name,item_type,base_unit_id,created_by)
       values($1,'Switch','purchased_component',$2,$3) returning id`,
      [org, piece, owner],
    );
    return r.rows[0]!.id;
  });
});
afterAll(async () => t.close());

describe('product and recipe transaction', () => {
  it('creates a product with its details atomically and denies outsider writes', async () => {
    await t.asUser(owner, async () => {
      const r = await t.db.query<{ name: string; expected_failure_rate: string }>(
        'select i.name,d.expected_failure_rate from public.items i join public.product_details d on d.item_id=i.id where i.id=$1',
        [product],
      );
      expect(r.rows[0]?.name).toBe('Keychain');
      expect(r.rows[0]?.expected_failure_rate).toBe('0.050000');
      await expect(
        t.db.query('select public.create_product($1,$2,$3,$4,$5)', [org, 'Bad', 'BAD', piece, '1']),
      ).rejects.toThrow();
      const count = await t.db.query<{ count: string }>(
        "select count(*) from public.items where sku='BAD'",
      );
      expect(String(count.rows[0]?.count)).toBe('0');
    });
    await t.asUser(outsider, async () => {
      await expect(
        t.db.query('select public.create_product($1,$2,$3,$4)', [org, 'Intruder', 'X', piece]),
      ).rejects.toThrow(/permission/);
      expect((await t.db.query('select * from public.product_details')).rows).toHaveLength(0);
    });
  });

  it('edits an unlocked recipe and creates a revision after a completed run locks it', async () => {
    const line = {
      line_type: 'component',
      ref_item_id: component,
      qty_per_unit: '3',
      unit_id: piece,
      waste_rate: '0.02',
    };
    const firstId = await t.asUser(owner, async () => {
      const first = await t.db.query<{ save_product_recipe: string }>(
        'select public.save_product_recipe($1,$2::jsonb,$3)',
        [product, JSON.stringify([line]), 'first'],
      );
      const firstId = first.rows[0]!.save_product_recipe;
      const edited = await t.db.query<{ save_product_recipe: string }>(
        'select public.save_product_recipe($1,$2::jsonb,$3)',
        [product, JSON.stringify([{ ...line, qty_per_unit: '4' }]), 'edited'],
      );
      expect(edited.rows[0]?.save_product_recipe).toBe(firstId);
      const beforeLock = await t.db.query<{ qty_per_unit: string }>(
        'select qty_per_unit from public.bom_lines where bom_id=$1',
        [firstId],
      );
      expect(beforeLock.rows[0]?.qty_per_unit).toBe('4.000000');

      // S8 marks the version locked when a run completes. Simulate that
      // database transition here; the revision rule must already protect it.
      return firstId;
    });
    await t.db.query('update public.boms set locked_at=now() where id=$1', [firstId]);
    await t.asUser(owner, async () => {
      const next = await t.db.query<{ save_product_recipe: string }>(
        'select public.save_product_recipe($1,$2::jsonb,$3)',
        [product, JSON.stringify([line]), 'next'],
      );
      expect(next.rows[0]?.save_product_recipe).not.toBe(firstId);
      const versions = await t.db.query<{ revision_no: number; status: string }>(
        'select revision_no,status from public.boms where item_id=$1 order by revision_no',
        [product],
      );
      expect(versions.rows).toEqual([
        { revision_no: 1, status: 'superseded' },
        { revision_no: 2, status: 'active' },
      ]);
      const oldLine = await t.db.query<{ qty_per_unit: string }>(
        'select qty_per_unit from public.bom_lines where bom_id=$1',
        [firstId],
      );
      expect(oldLine.rows[0]?.qty_per_unit).toBe('4.000000');
    });
    await expect(
      t.db.query('delete from public.bom_lines where bom_id=$1', [firstId]),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('refuses a direct and a transitive recipe cycle by product name', async () => {
    await t.asUser(owner, async () => {
      const own = {
        line_type: 'subassembly',
        ref_item_id: product,
        qty_per_unit: '1',
        unit_id: piece,
      };
      await expect(
        t.db.query('select public.save_product_recipe($1,$2::jsonb)', [
          product,
          JSON.stringify([own]),
        ]),
      ).rejects.toThrow(/Keychain.*cycle/);
      const sub = await t.db.query<{ create_product: string }>(
        'select public.create_product($1,$2,$3,$4)',
        [org, 'Subassembly', 'SUB-1', piece],
      );
      const subId = sub.rows[0]!.create_product;
      await t.db.query('select public.save_product_recipe($1,$2::jsonb)', [
        product,
        JSON.stringify([{ ...own, ref_item_id: subId }]),
      ]);
      await expect(
        t.db.query('select public.save_product_recipe($1,$2::jsonb)', [
          subId,
          JSON.stringify([{ ...own, ref_item_id: product }]),
        ]),
      ).rejects.toThrow(/Subassembly.*cycle/);
    });
  });

  it('rejects an incompatible unit, wrong item type and empty recipe', async () => {
    const kilogram = await t.db.query<{ id: string }>(
      "select id from public.units where code='kg' and org_id is null",
    );
    await t.asUser(owner, async () => {
      await expect(
        t.db.query('select public.save_product_recipe($1,$2::jsonb)', [product, '[]']),
      ).rejects.toThrow(/at least one/);
      await expect(
        t.db.query('select public.save_product_recipe($1,$2::jsonb)', [
          product,
          JSON.stringify([
            {
              line_type: 'component',
              ref_item_id: component,
              qty_per_unit: '1',
              unit_id: kilogram.rows[0]!.id,
            },
          ]),
        ]),
      ).rejects.toThrow(/no conversion/i);
      await expect(
        t.db.query('select public.save_product_recipe($1,$2::jsonb)', [
          product,
          JSON.stringify([
            { line_type: 'material', ref_item_id: component, qty_per_unit: '1', unit_id: piece },
          ]),
        ]),
      ).rejects.toThrow(/right type/);
    });
  });

  it('refuses missing quantities and amounts at the database boundary', async () => {
    await t.asUser(owner, async () => {
      for (const line of [
        { line_type: 'component', ref_item_id: component, unit_id: piece },
        { line_type: 'other_cost', notes: 'Missing amount' },
      ]) {
        await expect(
          t.db.query('select public.save_product_recipe($1,$2::jsonb)', [
            product,
            JSON.stringify([line]),
          ]),
        ).rejects.toThrow(/check constraint/);
      }
    });
  });
});
