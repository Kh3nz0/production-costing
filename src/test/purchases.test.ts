import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';

/**
 * S3's done-when. The F-01 and F-02 worked examples from
 * docs/phase3-calculations.md are the fixtures: if an implementation disagrees
 * with a worked example, the implementation is wrong until proven otherwise.
 */

let t: TestDb;
let owner: string;
let org: string;
let filament: string;
let switches: string;
let spool: string;
let pack: string;
let gram: string;
let piece: string;
let supplier: string;

async function unitId(code: string): Promise<string> {
  const r = await t.db.query<{ id: string }>(
    `select id from public.units where org_id is null and code = $1`,
    [code],
  );
  return r.rows[0]!.id;
}

async function newItem(
  name: string,
  base: string,
  purchase: string | null,
  factor: string | null,
): Promise<string> {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items
         (org_id, name, item_type, base_unit_id, purchase_unit_id, purchase_to_base_factor, created_by)
       values ($1, $2, 'raw_material', $3, $4, $5, $6) returning id`,
      [org, name, base, purchase, factor, owner],
    );
    return r.rows[0]!.id;
  });
}

interface LineSpec {
  item: string;
  qty: string;
  unit: string;
  priceCents: number;
  discountCents?: number;
  weight?: string | null;
}

async function draftPurchase(opts: {
  lines: LineSpec[];
  shippingCents?: number;
  dutiesCents?: number;
  otherCents?: number;
  discountCents?: number;
  base?: 'value' | 'quantity' | 'weight';
  reference?: string;
}): Promise<string> {
  return t.asUser(owner, async () => {
    const p = await t.db.query<{ id: string }>(
      `insert into public.purchases
         (org_id, supplier_id, reference_no, purchase_date, supplier_shipping_cents,
          duties_cents, other_landed_cost_cents, discount_cents, landed_cost_base, created_by)
       values ($1, $2, $3, '2026-09-16', $4, $5, $6, $7, $8, $9) returning id`,
      [
        org,
        supplier,
        opts.reference ?? null,
        opts.shippingCents ?? 0,
        opts.dutiesCents ?? 0,
        opts.otherCents ?? 0,
        opts.discountCents ?? 0,
        opts.base ?? 'value',
        owner,
      ],
    );
    const id = p.rows[0]!.id;
    for (const line of opts.lines) {
      await t.db.query(
        `insert into public.purchase_lines
           (org_id, purchase_id, item_id, qty_ordered, qty_received, purchase_unit_id,
            unit_price_cents, line_discount_cents, line_weight, created_by)
         values ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9)`,
        [
          org,
          id,
          line.item,
          line.qty,
          line.unit,
          line.priceCents,
          line.discountCents ?? 0,
          line.weight ?? null,
          owner,
        ],
      );
    }
    return id;
  });
}

async function receive(purchaseId: string): Promise<void> {
  await t.asUser(owner, async () => {
    await t.db.query(`select public.receive_purchase($1)`, [purchaseId]);
  });
}

async function lines(purchaseId: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{
      item_id: string;
      allocated_landed_cost_cents: string;
      landed_total_cents: string;
      receipt_unit_cost: string;
    }>(
      `select item_id, allocated_landed_cost_cents, landed_total_cents, receipt_unit_cost
       from public.purchase_lines where purchase_id = $1 order by item_id, id`,
      [purchaseId],
    );
    return r.rows;
  });
}

async function itemBalance(itemId: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ qty_on_hand: string; avg_unit_cost: string | null }>(
      `select qty_on_hand, avg_unit_cost from public.items where id = $1`,
      [itemId],
    );
    return r.rows[0]!;
  });
}

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('khenzo@bloop.ph');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      `select public.create_organization('Bloop')`,
    );
    return r.rows[0]!.create_organization;
  });
  [spool, pack, gram, piece] = await Promise.all([
    unitId('spool'),
    unitId('pack'),
    unitId('g'),
    unitId('pc'),
  ]);
  supplier = await t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.suppliers (org_id, name, created_by) values ($1, 'Filatech Supply', $2)
       returning id`,
      [org, owner],
    );
    return r.rows[0]!.id;
  });
  filament = await newItem('PLA Basic Filament', gram, spool, '1000');
  switches = await newItem('Mechanical Switch', piece, pack, '90');
});

afterAll(async () => {
  await t.close();
});

describe('F-01 landed unit cost, the worked example', () => {
  // 2 filament spools at P1,150.00, factor 1000 g. 1 pack of 90 switches at
  // P720.00, factor 90. Supplier shipping P180.00, value base.
  let purchase: string;

  beforeAll(async () => {
    purchase = await draftPurchase({
      reference: 'PUR-0916',
      shippingCents: 18000,
      lines: [
        { item: filament, qty: '2', unit: spool, priceCents: 115000 },
        { item: switches, qty: '1', unit: pack, priceCents: 72000 },
      ],
    });
    await receive(purchase);
  });

  it('allocates P137.09 and P42.91, reconciling to exactly P180.00', async () => {
    const rows = await lines(purchase);
    const byItem = new Map(rows.map((r) => [r.item_id, r]));
    const a = byItem.get(filament)!;
    const b = byItem.get(switches)!;

    expect(Money.fromCentavos(BigInt(a.allocated_landed_cost_cents)).format()).toBe('₱137.09');
    expect(Money.fromCentavos(BigInt(b.allocated_landed_cost_cents)).format()).toBe('₱42.91');
    expect(BigInt(a.allocated_landed_cost_cents) + BigInt(b.allocated_landed_cost_cents)).toBe(
      18000n,
    );
  });

  it('lands the lines at P2,437.09 and P762.91', async () => {
    const rows = await lines(purchase);
    const byItem = new Map(rows.map((r) => [r.item_id, r]));
    expect(Money.fromCentavos(BigInt(byItem.get(filament)!.landed_total_cents)).format()).toBe(
      '₱2,437.09',
    );
    expect(Money.fromCentavos(BigInt(byItem.get(switches)!.landed_total_cents)).format()).toBe(
      '₱762.91',
    );
  });

  it('derives the receipt unit costs to eight places', async () => {
    const rows = await lines(purchase);
    const byItem = new Map(rows.map((r) => [r.item_id, r]));
    // 2,437.09 / (2 x 1000) and 762.91 / (1 x 90)
    expect(toDecimal(byItem.get(filament)!.receipt_unit_cost).toFixed(8)).toBe('1.21854500');
    expect(toDecimal(byItem.get(switches)!.receipt_unit_cost).toFixed(8)).toBe('8.47677778');
  });

  it('turns the purchase into stock in base units', async () => {
    const f = await itemBalance(filament);
    const s = await itemBalance(switches);
    expect(toDecimal(f.qty_on_hand).toFixed(3)).toBe('2000.000');
    expect(toDecimal(s.qty_on_hand).toFixed(3)).toBe('90.000');
    expect(toDecimal(f.avg_unit_cost!).toFixed(8)).toBe('1.21854500');
    expect(toDecimal(s.avg_unit_cost!).toFixed(8)).toBe('8.47677778');
  });

  it('writes one ledger movement per line, carrying the resulting balance', async () => {
    const rows = await t.asUser(owner, async () => {
      const r = await t.db.query<{
        movement_type: string;
        quantity_change: string;
        resulting_qty: string;
        resulting_avg_cost: string;
        cost_effect_cents: string;
      }>(
        `select movement_type, quantity_change, resulting_qty, resulting_avg_cost, cost_effect_cents
         from public.inventory_movements
         where source_table = 'purchases' and source_id = $1
         order by item_id`,
        [purchase],
      );
      return r.rows;
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.movement_type).toBe('purchase_received');
      expect(toDecimal(row.quantity_change).gt(0)).toBe(true);
    }
  });

  it('closes the purchase to further editing', async () => {
    await t.asUser(owner, async () => {
      const r = await t.db.query(`update public.purchases set notes = 'late edit' where id = $1`, [
        purchase,
      ]);
      expect(r.affectedRows ?? 0).toBe(0);
    });
  });

  it('cannot be received twice', async () => {
    await expect(receive(purchase)).rejects.toThrow(/already been received/i);
  });
});

describe('F-02 moving weighted average, the worked example', () => {
  it('reproduces P1.20308261 per gram across two receipts', async () => {
    const item = await newItem('Filament for F-02', gram, spool, '1000');

    // First: 300 g at exactly P1.10 per gram, so the starting state matches the
    // worked example's "300 g on hand at P1.10000000".
    const first = await draftPurchase({
      reference: 'PUR-F02-A',
      // 0.3 of a spool is 300 g. P1,100.00 per spool makes the line P330.00,
      // so the starting average is exactly P1.10 per gram.
      lines: [{ item, qty: '0.3', unit: spool, priceCents: 110000 }],
    });
    await receive(first);

    const start = await itemBalance(item);
    expect(toDecimal(start.qty_on_hand).toFixed(3)).toBe('300.000');
    expect(toDecimal(start.avg_unit_cost!).toFixed(8)).toBe('1.10000000');

    // Then receive 2000 g with a landed total of P2,437.09: P2,300.00 of goods
    // plus P137.09 of shipping.
    const second = await draftPurchase({
      reference: 'PUR-F02-B',
      shippingCents: 13709,
      lines: [{ item, qty: '2', unit: spool, priceCents: 115000 }],
    });
    await receive(second);

    const after = await itemBalance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('2300.000');
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('1.20308261');

    // And the stock value is the P2,767.09 the spec states.
    expect(
      Money.fromDecimal(toDecimal(after.qty_on_hand).times(after.avg_unit_cost!)).format(),
    ).toBe('₱2,767.09');
  });

  it('does not value stock of unknown cost at zero (D-126)', async () => {
    // The live walkthrough produced exactly this state: 50 units arrived by
    // adjustment, so the item held a quantity nobody had costed. Valuing that
    // pile at zero and averaging it against a real purchase produced an
    // average below anything ever paid, stored as a plain number with nothing
    // marking it as a guess.
    const item = await newItem('Adjusted before any purchase', gram, spool, '1000');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.adjust_stock($1, 50, 'adjustment', 'Stock count')`, [item]);
    });
    const before = await itemBalance(item);
    expect(before.avg_unit_cost).toBeNull();

    // One spool, 1000 g, ₱1,100.00, so the established cost is ₱1.10 per gram.
    await receive(
      await draftPurchase({
        reference: 'PUR-UNKNOWN',
        lines: [{ item, qty: '1', unit: spool, priceCents: 110000 }],
      }),
    );

    const after = await itemBalance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('1050.000');
    // Before 0009 this was 1.04761905: ₱1,100.00 spread over 1,050 g because
    // the 50 g counted as free.
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('1.10000000');
  });

  it('still blends normally once a cost is established', async () => {
    // The exception is only for the null case. A second receipt against a
    // known average must go on averaging, or 0009 would have replaced F-02
    // rather than carved one case out of it.
    const item = await newItem('Known then bought again', gram, spool, '1000');
    await receive(
      await draftPurchase({
        reference: 'PUR-KNOWN-A',
        lines: [{ item, qty: '1', unit: spool, priceCents: 100000 }],
      }),
    );
    expect(toDecimal((await itemBalance(item)).avg_unit_cost!).toFixed(8)).toBe('1.00000000');

    await receive(
      await draftPurchase({
        reference: 'PUR-KNOWN-B',
        lines: [{ item, qty: '1', unit: spool, priceCents: 200000 }],
      }),
    );
    const after = await itemBalance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('2000.000');
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('1.50000000');
  });

  it('applies two lines for one item in sequence, not in parallel', async () => {
    // The second line must see the average the first produced. Getting this
    // wrong gives an average computed from a stale balance.
    const item = await newItem('Twice on one purchase', gram, spool, '1000');
    const p = await draftPurchase({
      reference: 'PUR-TWICE',
      lines: [
        { item, qty: '1', unit: spool, priceCents: 100000 },
        { item, qty: '1', unit: spool, priceCents: 200000 },
      ],
    });
    await receive(p);

    const after = await itemBalance(item);
    // 2000 g holding P3,000.00 is P1.50 per gram.
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('2000.000');
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('1.50000000');
  });
});

describe('the ledger is the truth and the cache agrees with it', () => {
  it('rebuild_item_balances reproduces every cached figure', async () => {
    const before = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string; qty_on_hand: string; avg_unit_cost: string | null }>(
        `select id, qty_on_hand, avg_unit_cost from public.items where org_id = $1 order by id`,
        [org],
      );
      return r.rows;
    });

    await t.asUser(owner, async () => {
      await t.db.query(`select public.rebuild_item_balances($1)`, [org]);
    });

    const after = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string; qty_on_hand: string; avg_unit_cost: string | null }>(
        `select id, qty_on_hand, avg_unit_cost from public.items where org_id = $1 order by id`,
        [org],
      );
      return r.rows;
    });

    expect(after).toEqual(before);
  });
});

describe('the ledger is append-only', () => {
  it('refuses an insert by hand, so the cache cannot be desynchronised', async () => {
    await t.asUser(owner, async () => {
      await expect(
        t.db.query(
          `insert into public.inventory_movements
             (org_id, item_id, movement_type, quantity_change, unit_id, resulting_qty, created_by)
           values ($1, $2, 'adjustment', 5, $3, 5, $4)`,
          [org, filament, gram, owner],
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it('refuses an update and a delete', async () => {
    await t.asUser(owner, async () => {
      await expect(
        t.db.query(`update public.inventory_movements set reason = 'nope'`),
      ).rejects.toThrow(/permission denied/i);
      await expect(t.db.query(`delete from public.inventory_movements`)).rejects.toThrow(
        /permission denied/i,
      );
    });
  });
});

describe('allocation base validation', () => {
  it('refuses quantity base when the purchase mixes dimensions', async () => {
    const p = await draftPurchase({
      reference: 'PUR-MIXED',
      base: 'quantity',
      shippingCents: 18000,
      lines: [
        { item: filament, qty: '800', unit: gram, priceCents: 120 },
        { item: switches, qty: '90', unit: piece, priceCents: 800 },
      ],
    });
    await expect(receive(p)).rejects.toThrow(
      /Allocate by quantity is unavailable because this purchase mixes/i,
    );
  });

  it('allows quantity base when every line shares one dimension', async () => {
    const other = await newItem('PETG Filament', gram, spool, '1000');
    const p = await draftPurchase({
      reference: 'PUR-SAME-DIM',
      base: 'quantity',
      shippingCents: 10000,
      lines: [
        { item: filament, qty: '1', unit: spool, priceCents: 100000 },
        { item: other, qty: '3', unit: spool, priceCents: 100000 },
      ],
    });
    await receive(p);
    const rows = await lines(p);
    const total = rows.reduce((a, r) => a + BigInt(r.allocated_landed_cost_cents), 0n);
    expect(total).toBe(10000n);
    // Split 1:3 by quantity, so P25.00 and P75.00.
    const sorted = rows
      .map((r) => BigInt(r.allocated_landed_cost_cents))
      .sort((a, b) => (a < b ? -1 : 1));
    expect(sorted).toEqual([2500n, 7500n]);
  });

  it('refuses weight base when a line carries no weight', async () => {
    const p = await draftPurchase({
      reference: 'PUR-NO-WEIGHT',
      base: 'weight',
      shippingCents: 5000,
      lines: [
        { item: filament, qty: '1', unit: spool, priceCents: 100000, weight: '1000' },
        { item: switches, qty: '1', unit: pack, priceCents: 50000 },
      ],
    });
    await expect(receive(p)).rejects.toThrow(/needs a weight on every line/i);
  });

  it('refuses a purchase with no lines', async () => {
    const p = await draftPurchase({ reference: 'PUR-EMPTY', lines: [] });
    await expect(receive(p)).rejects.toThrow(/at least one line/i);
  });
});

describe('the allocation rule has one definition, implemented twice', () => {
  // The database allocates when a purchase is received; the browser allocates
  // for the preview on the New purchase screen, before anything is saved. They
  // must agree exactly, so they are checked against each other here.
  const cases: Array<{ total: string; weights: string[] }> = [
    { total: '180.00', weights: ['2300.00', '720.00'] },
    { total: '1.00', weights: ['1', '1', '1'] },
    { total: '0.01', weights: ['1', '1', '1'] },
    { total: '100.00', weights: ['1', '2', '3', '7'] },
    { total: '9.99', weights: ['0.333', '0.333', '0.334'] },
    { total: '1234.57', weights: ['17', '83', '5', '1'] },
    { total: '77.77', weights: ['1', '0', '0'] },
  ];

  it('agrees with Money.allocate on every case', async () => {
    for (const { total, weights } of cases) {
      const money = Money.parse(total);
      const inBrowser = money.allocate(weights).map((m) => m.toCentavos());

      const inDatabase = await t.asUser(owner, async () => {
        const r = await t.db.query<{ allocate_cents: string[] }>(
          `select public.allocate_cents($1, $2::numeric[])`,
          [money.toCentavos().toString(), `{${weights.join(',')}}`],
        );
        return r.rows[0]!.allocate_cents.map((v) => BigInt(v));
      });

      expect(inDatabase, `${total} across ${weights.join('/')}`).toEqual(inBrowser);
      expect(
        inDatabase.reduce((a, b) => a + b, 0n),
        `${total} across ${weights.join('/')} must reconcile`,
      ).toBe(money.toCentavos());
    }
  });

  it('refuses the cases the browser refuses', async () => {
    await t.asUser(owner, async () => {
      await expect(
        t.db.query(`select public.allocate_cents(100, '{0,0}'::numeric[])`),
      ).rejects.toThrow(/sum to zero/i);
      await expect(
        t.db.query(`select public.allocate_cents(100, '{-1,2}'::numeric[])`),
      ).rejects.toThrow(/negative weight/i);
    });
  });
});
