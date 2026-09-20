import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { toDecimal } from '@/lib/decimal';

/**
 * Postgres `numeric` carries a scale, so the same value can come back as
 * `1500.00000000` from a multiplication and `1500.0000000000000000` from a
 * division. Scale is not part of the value, so quantities are compared
 * numerically rather than as strings.
 */
function expectQty(actual: string, expected: string): void {
  expect(
    toDecimal(actual).equals(toDecimal(expected)),
    `expected ${actual} to equal ${expected}`,
  ).toBe(true);
}

/**
 * S2's done-when, at the database level: an item exists with a purchase unit, a
 * base unit and a factor; an invalid conversion is refused with the spec's
 * message; archive hides an item from pickers and keeps it in history.
 *
 * F-04 is the formula under test. Its worked examples are the fixtures.
 */

let t: TestDb;
let owner: string;
let otherOwner: string;
let org: string;
let otherOrg: string;

async function unitId(code: string): Promise<string> {
  const r = await t.db.query<{ id: string }>(
    `select id from public.units where org_id is null and code = $1`,
    [code],
  );
  const id = r.rows[0]?.id;
  if (id === undefined) throw new Error(`No seeded unit ${code}`);
  return id;
}

interface NewItem {
  name: string;
  type?: string;
  sku?: string | null;
  base: string;
  purchase?: string | null;
  factor?: string | null;
  orgId?: string;
  userId?: string;
}

async function createItem(spec: NewItem): Promise<string> {
  const orgId = spec.orgId ?? org;
  const userId = spec.userId ?? owner;
  return t.asUser(userId, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items
         (org_id, name, sku, item_type, base_unit_id, purchase_unit_id, purchase_to_base_factor, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        orgId,
        spec.name,
        spec.sku ?? null,
        spec.type ?? 'raw_material',
        await unitId(spec.base),
        spec.purchase === undefined || spec.purchase === null ? null : await unitId(spec.purchase),
        spec.factor ?? null,
        userId,
      ],
    );
    const id = r.rows[0]?.id;
    if (id === undefined) throw new Error(`Could not create item ${spec.name}`);
    return id;
  });
}

async function convert(itemId: string, qty: string, unitCode: string): Promise<string> {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ convert_to_base: string }>(
      `select public.convert_to_base($1, $2, $3)`,
      [itemId, qty, await unitId(unitCode)],
    );
    const value = r.rows[0]?.convert_to_base;
    if (value === undefined) throw new Error('No conversion result');
    return String(value);
  });
}

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('khenzo@bloop.ph');
  otherOwner = await t.createUser('rival@other.example');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      `select public.create_organization('Bloop')`,
    );
    return r.rows[0]!.create_organization;
  });
  otherOrg = await t.asUser(otherOwner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      `select public.create_organization('Rival Co')`,
    );
    return r.rows[0]!.create_organization;
  });
});

afterAll(async () => {
  await t.close();
});

describe('an item is created with a purchase unit, a base unit and a factor', () => {
  it('stores all three', async () => {
    const id = await createItem({
      name: 'PLA Basic Filament',
      sku: 'FIL-PLA-BLK',
      base: 'g',
      purchase: 'spool',
      factor: '1000',
    });

    const row = await t.asUser(owner, async () => {
      const r = await t.db.query<{
        name: string;
        sku: string;
        base_code: string;
        purchase_code: string;
        factor: string;
      }>(
        `select i.name, i.sku, b.code as base_code, p.code as purchase_code,
                i.purchase_to_base_factor as factor
         from public.items i
         join public.units b on b.id = i.base_unit_id
         join public.units p on p.id = i.purchase_unit_id
         where i.id = $1`,
        [id],
      );
      return r.rows[0];
    });

    expect(row?.name).toBe('PLA Basic Filament');
    expect(row?.sku).toBe('FIL-PLA-BLK');
    expect(row?.base_code).toBe('g');
    expect(row?.purchase_code).toBe('spool');
    expect(String(row?.factor)).toBe('1000.00000000');
  });

  it('refuses a purchase unit with no factor to relate it to the base', async () => {
    // Without this the costing engine would hold a row it cannot convert, and
    // the failure would surface much later as a wrong material cost.
    await expect(
      createItem({ name: 'Unrelatable', base: 'g', purchase: 'spool', factor: null }),
    ).rejects.toThrow(/items_purchase_factor_required/);
  });

  it('allows a purchase unit equal to the base unit with no factor', async () => {
    const id = await createItem({ name: 'Ball Chain', base: 'mm', purchase: 'mm' });
    expectQty(await convert(id, '250', 'mm'), '250');
  });

  it('refuses a factor of zero or below', async () => {
    await expect(
      createItem({ name: 'Zero factor', base: 'g', purchase: 'spool', factor: '0' }),
    ).rejects.toThrow(/purchase_to_base_factor/);
  });
});

describe('F-04 unit conversion', () => {
  it('reproduces the worked example: a spool of 1000 g', async () => {
    const id = await createItem({
      name: 'Filament for conversion',
      base: 'g',
      purchase: 'spool',
      factor: '1000',
    });
    expectQty(await convert(id, '2', 'spool'), '2000.00000000');
    expectQty(await convert(id, '18.4', 'g'), '18.4');
  });

  it('uses the item factor even when both units share a dimension', async () => {
    // A pack and a piece are both `count`. Dimension arithmetic alone would make
    // one pack of 90 switches into one piece, and every material cost
    // downstream would be wrong by a factor of ninety.
    const id = await createItem({
      name: 'Mechanical Switch',
      base: 'pc',
      purchase: 'pack',
      factor: '90',
    });
    expectQty(await convert(id, '1', 'pack'), '90.00000000');
    expectQty(await convert(id, '2', 'pack'), '180.00000000');
    expectQty(await convert(id, '87', 'pc'), '87');
  });

  it('converts automatically within a dimension', async () => {
    const id = await createItem({ name: 'PETG Filament', base: 'g' });
    expectQty(await convert(id, '1.5', 'kg'), '1500.00000000');
    expectQty(await convert(id, '2500', 'mg'), '2.50000000');
  });

  it('keeps eight decimal places of the factor', async () => {
    const id = await createItem({
      name: 'Odd pack',
      base: 'g',
      purchase: 'pack',
      factor: '33.33333333',
    });
    expectQty(await convert(id, '3', 'pack'), '99.99999999');
  });
});

describe('an invalid conversion is refused with the spec message', () => {
  it('names both units and the item, and says what to do', async () => {
    const id = await createItem({ name: 'Blank Keycap', base: 'g' });

    // Piece is `count`, the base is `mass`, and the item declares no factor
    // between them. F-04 rule 3: never silently pass.
    await expect(convert(id, '5', 'pc')).rejects.toThrow(
      'There is no conversion between Gram and Piece for Blank Keycap. ' +
        'Set how many Gram are in one Piece on the item first.',
    );
  });

  it('refuses rather than falling back to one to one', async () => {
    const id = await createItem({ name: 'Plastic Bag', base: 'ml' });
    await expect(convert(id, '1', 'kg')).rejects.toThrow(/no conversion between/i);
  });
});

describe('SKU uniqueness', () => {
  it('is per organization, not global', async () => {
    await createItem({ name: 'Ours', sku: 'SHARED-SKU', base: 'g' });
    const theirs = await createItem({
      name: 'Theirs',
      sku: 'SHARED-SKU',
      base: 'g',
      orgId: otherOrg,
      userId: otherOwner,
    });
    expect(theirs).toBeTruthy();
  });

  it('refuses a duplicate within one organization', async () => {
    await createItem({ name: 'First', sku: 'DUP-SKU', base: 'g' });
    await expect(createItem({ name: 'Second', sku: 'DUP-SKU', base: 'g' })).rejects.toThrow(
      /items_org_sku_unique/,
    );
  });

  it('allows many items with no SKU at all', async () => {
    await createItem({ name: 'No SKU one', base: 'g' });
    await createItem({ name: 'No SKU two', base: 'g' });
    const n = await t.asUser(owner, async () => {
      const r = await t.db.query<{ n: number }>(
        `select count(*)::int as n from public.items where org_id = $1 and sku is null`,
        [org],
      );
      return r.rows[0]?.n ?? -1;
    });
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

describe('archive hides an item from pickers and keeps it in history', () => {
  it('stays readable after archiving', async () => {
    const id = await createItem({ name: 'Retired Filament', base: 'g' });

    await t.asUser(owner, async () => {
      const r = await t.db.query(`update public.items set archived_at = now() where id = $1`, [id]);
      expect(r.affectedRows).toBe(1);
    });

    const seen = await t.asUser(owner, async () => {
      const all = await t.db.query<{ n: number }>(
        `select count(*)::int as n from public.items where id = $1`,
        [id],
      );
      const active = await t.db.query<{ n: number }>(
        `select count(*)::int as n from public.items where id = $1 and archived_at is null`,
        [id],
      );
      return { all: all.rows[0]?.n, active: active.rows[0]?.n };
    });

    // Still there for history, gone from anything that picks active items.
    expect(seen.all).toBe(1);
    expect(seen.active).toBe(0);
  });

  it('cannot be deleted, only archived', async () => {
    const id = await createItem({ name: 'Undeletable', base: 'g' });
    await t.asUser(owner, async () => {
      await expect(t.db.query(`delete from public.items where id = $1`, [id])).rejects.toThrow(
        /permission denied|row-level security/i,
      );
    });
  });
});

describe('items are scoped to their organization', () => {
  it('are invisible to another org even when named directly', async () => {
    const mine = await createItem({ name: 'Private Filament', base: 'g' });
    const rows = await t.asUser(otherOwner, async () => {
      const r = await t.db.query(`select id from public.items where id = $1`, [mine]);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('cannot be created in an org the caller does not belong to', async () => {
    await expect(
      createItem({ name: 'Trespass', base: 'g', orgId: org, userId: otherOwner }),
    ).rejects.toThrow(/row-level security/i);
  });
});
