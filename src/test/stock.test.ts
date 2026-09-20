import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';

/**
 * S4's done-when: every change is a movement carrying resulting quantity and
 * average; `rebuild_item_balances` reproduces every cached figure; an opening
 * balance needs no purchase; an adjustment requires a reason; negative stock is
 * refused with the spec's message; valuation as of a past date is correct after
 * later receipts.
 */

let t: TestDb;
let owner: string;
let org: string;
let gram: string;
let spool: string;

async function unitId(code: string): Promise<string> {
  const r = await t.db.query<{ id: string }>(
    `select id from public.units where org_id is null and code = $1`,
    [code],
  );
  return r.rows[0]!.id;
}

async function newItem(name: string): Promise<string> {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items
         (org_id, name, item_type, base_unit_id, purchase_unit_id, purchase_to_base_factor, created_by)
       values ($1, $2, 'raw_material', $3, $4, 1000, $5) returning id`,
      [org, name, gram, spool, owner],
    );
    return r.rows[0]!.id;
  });
}

async function receiveSpools(item: string, spools: string, pricePerSpool: string, date: string) {
  await t.asUser(owner, async () => {
    const p = await t.db.query<{ id: string }>(
      `insert into public.purchases (org_id, purchase_date, created_by)
       values ($1, $2, $3) returning id`,
      [org, date, owner],
    );
    const id = p.rows[0]!.id;
    await t.db.query(
      `insert into public.purchase_lines
         (org_id, purchase_id, item_id, qty_ordered, qty_received, purchase_unit_id,
          unit_price_cents, created_by)
       values ($1, $2, $3, $4, $4, $5, $6, $7)`,
      [org, id, item, spools, spool, Money.parse(pricePerSpool).toCentavos().toString(), owner],
    );
    await t.db.query(`select public.receive_purchase($1)`, [id]);
  });
}

async function balance(item: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ qty_on_hand: string; avg_unit_cost: string | null }>(
      `select qty_on_hand, avg_unit_cost from public.items where id = $1`,
      [item],
    );
    return r.rows[0]!;
  });
}

async function movements(item: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{
      movement_type: string;
      quantity_change: string;
      resulting_qty: string;
      resulting_avg_cost: string | null;
      unit_cost_at_movement: string | null;
      cost_effect_cents: string | null;
      reason: string | null;
    }>(
      `select movement_type, quantity_change, resulting_qty, resulting_avg_cost,
              unit_cost_at_movement, cost_effect_cents, reason
       from public.inventory_movements where item_id = $1 order by seq`,
      [item],
    );
    return r.rows;
  });
}

async function valuation(asOf: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{
      item_name: string;
      quantity: string;
      unit_cost: string | null;
      value_cents: string | null;
    }>(
      `select item_name, quantity, unit_cost, value_cents from public.inventory_valuation($1, $2)`,
      [org, asOf],
    );
    return r.rows;
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
  gram = await unitId('g');
  spool = await unitId('spool');
});

afterAll(async () => {
  await t.close();
});

describe('an opening balance needs no purchase', () => {
  it('sets the quantity and the cost with nothing bought', async () => {
    const item = await newItem('Opening with cost');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 300, 1.10, '2026-03-02')`, [item]);
    });

    const after = await balance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('300.000');
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('1.10000000');

    const rows = await movements(item);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.movement_type).toBe('opening_balance');
    expect(Money.fromCentavos(BigInt(rows[0]!.cost_effect_cents!)).format()).toBe('₱330.00');
  });

  it('leaves the cost unknown rather than guessing when none is given', async () => {
    // "If you do not know what it cost, leave the cost blank. The item will show
    // no unit cost until your next purchase, which is more honest than a guess."
    const item = await newItem('Opening without cost');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 50)`, [item]);
    });
    const after = await balance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('50.000');
    expect(after.avg_unit_cost).toBeNull();
  });

  it('picks up a real cost at the next purchase', async () => {
    const item = await newItem('Uncosted then bought');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 1000)`, [item]);
    });
    // 1000 g held at no known cost, then 1000 g arrives at ₱2.00 per gram.
    await receiveSpools(item, '1', '2000.00', '2026-04-01');

    const after = await balance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('2000.000');
    // Reversed by D-126, and this test is the record of the argument. It used
    // to expect ₱1.00: the unknown stock counted as worth nothing, so ₱2,000.00
    // spread across 2,000 g. That kept stock value equal to money spent, at the
    // price of a material cost below anything ever paid — and an understated
    // material cost silently underprices every unit sold, which is the failure
    // this product exists to prevent. The price just paid now stands for the
    // whole pile.
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('2.00000000');
  });

  it('refuses a second opening balance, which would rewrite history', async () => {
    const item = await newItem('Opening twice');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 10, 1)`, [item]);
      await expect(
        t.db.query(`select public.record_opening_balance($1, 99, 9)`, [item]),
      ).rejects.toThrow(/already has stock history/i);
    });
  });

  it('refuses a quantity of zero or below', async () => {
    const item = await newItem('Opening zero');
    await t.asUser(owner, async () => {
      await expect(
        t.db.query(`select public.record_opening_balance($1, 0)`, [item]),
      ).rejects.toThrow(/above zero/i);
    });
  });
});

describe('an adjustment requires a reason', () => {
  it('refuses a blank one', async () => {
    const item = await newItem('Needs a reason');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 100, 1)`, [item]);
      await expect(
        t.db.query(`select public.adjust_stock($1, 90, 'adjustment', '   ')`, [item]),
      ).rejects.toThrow(/reason is required/i);
      await expect(
        t.db.query(`select public.adjust_stock($1, 90, 'adjustment', null)`, [item]),
      ).rejects.toThrow(/reason is required/i);
    });
  });

  it('keeps the reason on the movement', async () => {
    const item = await newItem('Counted');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 100, 2)`, [item]);
      await t.db.query(
        `select public.adjust_stock($1, 94, 'adjustment', 'Counted 94 on the shelf')`,
        [item],
      );
    });
    const rows = await movements(item);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.reason).toBe('Counted 94 on the shelf');
  });

  it('records only what changed, and never moves the average', async () => {
    const item = await newItem('Shrinkage');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 100, 2.5)`, [item]);
      await t.db.query(`select public.adjust_stock($1, 94, 'damage', 'Six dropped')`, [item]);
    });

    const rows = await movements(item);
    const adjustment = rows[1]!;
    expect(toDecimal(adjustment.quantity_change).toFixed(3)).toBe('-6.000');
    expect(toDecimal(adjustment.resulting_qty).toFixed(3)).toBe('94.000');
    // The average is unchanged: only a receipt moves it (F-02).
    expect(toDecimal(adjustment.resulting_avg_cost!).toFixed(8)).toBe('2.50000000');
    expect(toDecimal(adjustment.unit_cost_at_movement!).toFixed(8)).toBe('2.50000000');
    // Six units at ₱2.50 is ₱15.00 of value gone.
    expect(Money.fromCentavos(BigInt(adjustment.cost_effect_cents!)).format()).toBe('\u2212₱15.00');

    const after = await balance(item);
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('2.50000000');
  });

  it('refuses an adjustment to the quantity already on hand', async () => {
    const item = await newItem('No change');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 40, 1)`, [item]);
      await expect(
        t.db.query(`select public.adjust_stock($1, 40, 'adjustment', 'Same')`, [item]),
      ).rejects.toThrow(/nothing to record/i);
    });
  });

  it('refuses a movement type that is not an adjustment', async () => {
    const item = await newItem('Wrong type');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 40, 1)`, [item]);
      await expect(
        t.db.query(`select public.adjust_stock($1, 30, 'sale', 'Sneaking a sale in')`, [item]),
      ).rejects.toThrow(/not sale/i);
    });
  });
});

describe('negative stock is refused with the spec message', () => {
  it('names the shortfall, the unit and the item, and says what to do', async () => {
    const item = await newItem('PLA Basic');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 100, 1)`, [item]);
      await expect(
        t.db.query(`select public.adjust_stock($1, -40, 'adjustment', 'Typed it wrong')`, [item]),
      ).rejects.toThrow(
        'This would leave -40 g of PLA Basic. Record a purchase or an opening balance first, or reduce the quantity.',
      );
    });
  });

  it('leaves the stock untouched when it refuses', async () => {
    const item = await newItem('Untouched by refusal');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 100, 1)`, [item]);
      await expect(
        t.db.query(`select public.adjust_stock($1, -1, 'adjustment', 'No')`, [item]),
      ).rejects.toThrow();
    });
    const after = await balance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('100.000');
    expect(await movements(item)).toHaveLength(1);
  });

  it('allows going to exactly zero', async () => {
    const item = await newItem('Down to nothing');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 25, 4)`, [item]);
      await t.db.query(`select public.adjust_stock($1, 0, 'waste', 'All of it spoiled')`, [item]);
    });
    const after = await balance(item);
    expect(toDecimal(after.qty_on_hand).toFixed(3)).toBe('0.000');
    // Still costed: the average survives an empty shelf, ready for the next
    // receipt to blend into.
    expect(toDecimal(after.avg_unit_cost!).toFixed(8)).toBe('4.00000000');
  });
});

describe('every change is a movement carrying the resulting balance', () => {
  it('reads back as a running history', async () => {
    const item = await newItem('History');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 300, 1.10, '2026-03-02')`, [item]);
    });
    await receiveSpools(item, '2', '1150.00', '2026-09-16');
    await t.asUser(owner, async () => {
      await t.db.query(
        `select public.adjust_stock($1, 2290, 'waste', 'Purge losses', '2026-09-18')`,
        [item],
      );
    });

    const rows = await movements(item);
    expect(rows.map((r) => r.movement_type)).toEqual([
      'opening_balance',
      'purchase_received',
      'waste',
    ]);
    expect(rows.map((r) => toDecimal(r.resulting_qty).toFixed(0))).toEqual(['300', '2300', '2290']);
    // Every row carries the average that applied after it.
    expect(rows.every((r) => r.resulting_avg_cost !== null)).toBe(true);
  });

  it('agrees with rebuild_item_balances after adjustments as well as receipts', async () => {
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

describe('valuation as of a past date', () => {
  it('stays correct after a later receipt', async () => {
    const item = await newItem('Valued over time');

    // 300 g at ₱1.10 on 2 March, worth ₱330.00.
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 300, 1.10, '2026-03-02')`, [item]);
    });

    const atMarch = (await valuation('2026-03-31')).find((r) => r.item_name === 'Valued over time');
    expect(toDecimal(atMarch!.quantity).toFixed(3)).toBe('300.000');
    expect(Money.fromCentavos(BigInt(atMarch!.value_cents!)).format()).toBe('₱330.00');

    // Then 2,000 g arrives on 16 September at a landed ₱2,300.00.
    await receiveSpools(item, '2', '1150.00', '2026-09-16');

    // March is unchanged. This is the assertion that matters: a movement
    // recorded later cannot alter what an earlier date was worth.
    const marchAgain = (await valuation('2026-03-31')).find(
      (r) => r.item_name === 'Valued over time',
    );
    expect(toDecimal(marchAgain!.quantity).toFixed(3)).toBe('300.000');
    expect(Money.fromCentavos(BigInt(marchAgain!.value_cents!)).format()).toBe('₱330.00');

    // September reflects both.
    const atSeptember = (await valuation('2026-09-30')).find(
      (r) => r.item_name === 'Valued over time',
    );
    expect(toDecimal(atSeptember!.quantity).toFixed(3)).toBe('2300.000');
    expect(Money.fromCentavos(BigInt(atSeptember!.value_cents!)).format()).toBe('₱2,630.00');
  });

  it('shows nothing on hand before the first movement', async () => {
    const item = await newItem('Not yet owned');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 10, 5, '2026-06-01')`, [item]);
    });
    const early = (await valuation('2026-01-01')).find((r) => r.item_name === 'Not yet owned');
    expect(toDecimal(early!.quantity).toFixed(3)).toBe('0.000');
    expect(early!.value_cents).toBeNull();
  });

  it('gives no value for stock whose cost is unknown, rather than zero', async () => {
    const item = await newItem('Unknown cost valuation');
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1, 77, null, '2026-05-01')`, [item]);
    });
    const row = (await valuation('2026-12-31')).find(
      (r) => r.item_name === 'Unknown cost valuation',
    );
    expect(toDecimal(row!.quantity).toFixed(3)).toBe('77.000');
    expect(row!.unit_cost).toBeNull();
    // Null, not ₱0.00. Stock with an unknown cost is not worthless.
    expect(row!.value_cents).toBeNull();
  });

  it('is scoped by RLS like everything else', async () => {
    const stranger = await t.createUser('stranger@example.test');
    const rows = await t.asUser(stranger, async () => {
      const r = await t.db.query(`select * from public.inventory_valuation($1)`, [org]);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });
});
