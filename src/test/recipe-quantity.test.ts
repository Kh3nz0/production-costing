import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { recipeQuantityInBase, type RecipeItemUnits, type RecipeUnit } from '@/lib/recipe-quantity';
import { toDecimal } from '@/lib/decimal';

let t: TestDb;
let owner: string;
let org: string;
let units: RecipeUnit[];

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('recipe-quantity@example.test');
  org = await t.asUser(owner, async () => {
    const result = await t.db.query<{ id: string }>(
      "select public.create_organization('Recipe quantity') as id",
    );
    return result.rows[0]!.id;
  });
  units = (
    await t.db.query<RecipeUnit>(
      'select id,code,dimension_code,factor_to_dimension_base::text from public.units where org_id is null',
    )
  ).rows;
});

afterAll(async () => t.close());

it('matches F-04 SQL for item pack factors, dimension conversions and large exact quantities', async () => {
  const unit = (code: string) => units.find((value) => value.code === code)!.id;
  const fixtures = [
    {
      name: 'Filament',
      base: 'g',
      purchase: 'spool',
      factor: '750',
      from: 'spool',
      qty: '2',
      expected: '1500',
    },
    {
      name: 'Filament kg',
      base: 'g',
      purchase: 'spool',
      factor: '750',
      from: 'kg',
      qty: '1.25',
      expected: '1250',
    },
    {
      name: 'Switches',
      base: 'pc',
      purchase: 'pack',
      factor: '90',
      from: 'pack',
      qty: '2',
      expected: '180',
    },
    {
      name: 'Exact quantity',
      base: 'g',
      purchase: 'g',
      factor: null,
      from: 'g',
      qty: '12345678901234.123456',
      expected: '12345678901234.123456',
    },
  ];
  await t.asUser(owner, async () => {
    for (const fixture of fixtures) {
      const item: RecipeItemUnits = {
        name: fixture.name,
        base_unit_id: unit(fixture.base),
        purchase_unit_id: unit(fixture.purchase),
        purchase_to_base_factor: fixture.factor,
      };
      const inserted = await t.db.query<{ id: string }>(
        `insert into public.items(org_id,name,item_type,base_unit_id,purchase_unit_id,purchase_to_base_factor,created_by)
         values($1,$2,'raw_material',$3,$4,$5,$6) returning id`,
        [
          org,
          item.name,
          item.base_unit_id,
          item.purchase_unit_id,
          item.purchase_to_base_factor,
          owner,
        ],
      );
      const sql = await t.db.query<{ value: string }>(
        'select public.convert_to_base($1,$2,$3)::text as value',
        [inserted.rows[0]!.id, fixture.qty, unit(fixture.from)],
      );
      const calculated = recipeQuantityInBase(item, fixture.qty, unit(fixture.from), units);
      expect(calculated.eq(toDecimal(sql.rows[0]!.value))).toBe(true);
      expect(calculated.toString()).toBe(fixture.expected);
      expect(() => recipeQuantityInBase(item, '1', unit('ml'), units)).toThrow(/no conversion/);
    }
  });
});
