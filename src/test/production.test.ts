import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';

/**
 * S8's done-when: the F-11 example reproduces ₱82.93 per accepted unit and
 * ₱535.89 of production loss; completion is one transaction; changing a
 * material price afterwards leaves the run unchanged; a completed run cannot be
 * edited.
 */

let t: TestDb;
let owner: string;
let org: string;
let gram: string;
let piece: string;
let filament: string;
let product: string;

async function unit(code: string): Promise<string> {
  const r = await t.db.query<{ id: string }>(
    'select id from public.units where org_id is null and code = $1',
    [code],
  );
  return r.rows[0]!.id;
}

async function item(name: string, base: string, type = 'raw_material'): Promise<string> {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.items(org_id,name,item_type,base_unit_id,purchase_unit_id,
                                purchase_to_base_factor,created_by)
       values($1,$2,$3,$4,$4,1,$5) returning id`,
      [org, name, type, base, owner],
    );
    return r.rows[0]!.id;
  });
}

async function run(id: string) {
  return t.asUser(owner, async () => {
    const r = await t.db.query<{
      status: string;
      units_started: number;
      units_accepted: number;
      units_failed: number;
      actual_total_cost_cents: string;
      abnormal_loss_cents: string;
      capitalised_cost_cents: string;
      actual_cost_per_accepted_unit: string | null;
      rate_snapshot: Record<string, unknown>;
    }>('select * from public.production_runs where id=$1', [id]);
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
  owner = await t.createUser('production-owner@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      "select public.create_organization('Bloop production')",
    );
    return r.rows[0]!.create_organization;
  });
  gram = await unit('g');
  piece = await unit('pc');

  filament = await item('PLA Basic Filament', gram);
  await t.asUser(owner, async () => {
    // 10,000 g at exactly ₱2.00 so the run's material cost is easy to read.
    // Dated explicitly, not `now()`: every other date in this file is fixed, so
    // a default of today made the fixture pass until the clock rolled past the
    // run's date and the ordering rule correctly refused it (D-128).
    await t.db.query(`select public.record_opening_balance($1,10000,2.00,'2026-09-01')`, [
      filament,
    ]);
  });

  product = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_product: string }>(
      'select public.create_product($1,$2,$3,$4,$5)',
      [org, 'Clickable Keychain', 'KEY-S8', piece, '0.05'],
    );
    return r.rows[0]!.create_product;
  });
  await t.asUser(owner, async () => {
    await t.db.query('select public.save_product_recipe($1,$2::jsonb,null)', [
      product,
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
  });
});
afterAll(async () => t.close());

describe('F-11, the worked example, end to end', () => {
  let id: string;

  it('starts enough units to end up with the number wanted', async () => {
    id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ start_production_run: string }>(
        'select public.start_production_run($1,20,null,null,$2)',
        [product, '2026-09-20'],
      );
      return r.rows[0]!.start_production_run;
    });
    const started = await run(id);
    // 20 / 0.95 = 21.05, so 22 starts. Planning 20 starts for 20 accepted is
    // how every run quietly comes up short.
    expect(started.units_started).toBe(22);
    expect(started.status).toBe('in_progress');
  });

  it('completes as one transaction, splitting normal failures from the rest', async () => {
    // Override the recipe's expectation with what actually happened: 20 units
    // started, 400 g of filament used at ₱2.00 = ₱800.00, plus other costs
    // brought in as a line, to land on F-11's ₱1,531.10 total.
    const lines = await t.asUser(owner, async () => {
      const r = await t.db.query<{ id: string; line_type: string }>(
        'select id,line_type from public.production_run_lines where run_id=$1',
        [id],
      );
      return r.rows;
    });
    const material = lines.find((l) => l.line_type === 'material')!;

    await t.asUser(owner, async () => {
      await t.db.query('select public.complete_production_run($1,$2::jsonb,$3,$4)', [
        id,
        JSON.stringify([{ id: material.id, actual_qty: '765.55' }]),
        12,
        8,
      ]);
    });

    const done = await run(id);
    expect(done.status).toBe('completed');
    expect(done.units_started).toBe(20);
    // 765.55 g × ₱2.00 = ₱1,531.10, the worked example's actual run cost.
    expect(Money.fromCentavos(BigInt(done.actual_total_cost_cents)).format()).toBe('₱1,531.10');
    expect(Money.fromCentavos(BigInt(done.abnormal_loss_cents)).format()).toBe('₱535.89');
    expect(Money.fromCentavos(BigInt(done.capitalised_cost_cents)).format()).toBe('₱995.21');
    expect(toDecimal(done.actual_cost_per_accepted_unit!).toFixed(4)).toBe('82.9342');
  });

  it('took the material out of stock and put the good units in', async () => {
    const material = await balance(filament);
    expect(toDecimal(material.qty_on_hand).toFixed(2)).toBe('9234.45');
    // An adjustment never moves the average, and neither does consumption.
    expect(toDecimal(material.avg_unit_cost!).toFixed(8)).toBe('2.00000000');

    const finished = await balance(product);
    expect(toDecimal(finished.qty_on_hand).toFixed(0)).toBe('12');
    expect(toDecimal(finished.avg_unit_cost!).toFixed(4)).toBe('82.9342');
  });

  it('wrote a consumption movement and an output movement, and no failure row', async () => {
    const movements = await t.asUser(owner, async () => {
      const r = await t.db.query<{ movement_type: string; quantity_change: string }>(
        `select movement_type,quantity_change from public.inventory_movements
         where source_id=$1 order by seq`,
        [id],
      );
      return r.rows;
    });
    expect(movements.map((m) => m.movement_type)).toEqual([
      'production_consumption',
      'production_output',
    ]);
    // Failed units never entered stock, so there is no quantity to record. The
    // loss is the gap between what left at cost and what arrived capitalised.
    expect(toDecimal(movements[0]!.quantity_change).toFixed(2)).toBe('-765.55');
    expect(toDecimal(movements[1]!.quantity_change).toFixed(0)).toBe('12');
  });

  it('does not move when a material price changes afterwards', async () => {
    const before = await run(id);
    await t.asUser(owner, async () => {
      const p = await t.db.query<{ id: string }>(
        `insert into public.purchases(org_id,purchase_date,created_by)
         values($1,'2026-09-21',$2) returning id`,
        [org, owner],
      );
      await t.db.query(
        `insert into public.purchase_lines
           (org_id,purchase_id,item_id,qty_ordered,qty_received,purchase_unit_id,
            unit_price_cents,created_by)
         values($1,$2,$3,5000,5000,$4,900,$5)`,
        [org, p.rows[0]!.id, filament, gram, owner],
      );
      await t.db.query('select public.receive_purchase($1)', [p.rows[0]!.id]);
    });

    // The item's average moved a long way.
    const material = await balance(filament);
    expect(toDecimal(material.avg_unit_cost!).gt(toDecimal('4'))).toBe(true);

    // The run did not.
    const after = await run(id);
    expect(after.actual_total_cost_cents).toBe(before.actual_total_cost_cents);
    expect(after.capitalised_cost_cents).toBe(before.capitalised_cost_cents);
    expect(after.actual_cost_per_accepted_unit).toBe(before.actual_cost_per_accepted_unit);
  });

  it('cannot be completed twice, or edited by hand', async () => {
    await t.asUser(owner, async () => {
      await expect(
        t.db.query('select public.complete_production_run($1,$2::jsonb,1,0)', [
          id,
          JSON.stringify([]),
        ]),
      ).rejects.toThrow(/already completed/i);
      await expect(
        t.db.query('update public.production_runs set units_accepted=999 where id=$1', [id]),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        t.db.query('delete from public.production_runs where id=$1', [id]),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});

describe('a completed run is reversed, never edited', () => {
  it('writes an opposite movement for every movement it made', async () => {
    const before = await balance(filament);
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ start_production_run: string }>(
        'select public.start_production_run($1,2,null,null,$2)',
        [product, '2026-09-22'],
      );
      return r.rows[0]!.start_production_run;
    });
    await t.asUser(owner, async () => {
      await t.db.query('select public.complete_production_run($1,null,2,0)', [id]);
    });

    const made = await balance(product);
    await t.asUser(owner, async () => {
      await t.db.query('select public.reverse_production_run($1,$2)', [
        id,
        'Counted the wrong batch',
      ]);
    });

    const reversed = await run(id);
    expect(reversed.status).toBe('cancelled');

    // The material came back and the finished units went away.
    const material = await balance(filament);
    expect(toDecimal(material.qty_on_hand).toFixed(2)).toBe(
      toDecimal(before.qty_on_hand).toFixed(2),
    );
    const finished = await balance(product);
    expect(toDecimal(finished.qty_on_hand).lt(toDecimal(made.qty_on_hand))).toBe(true);

    // Both the original and the reversal are still there, and every reversal
    // points at what it undid.
    const rows = await t.asUser(owner, async () => {
      const r = await t.db.query<{ reversal_of_id: string | null; reason: string | null }>(
        'select reversal_of_id,reason from public.inventory_movements where source_id=$1 order by seq',
        [id],
      );
      return r.rows;
    });
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.reversal_of_id !== null)).toHaveLength(2);
    expect(rows.at(-1)!.reason).toBe('Counted the wrong batch');
  });

  it('refuses a reversal with no reason, and a second reversal', async () => {
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ start_production_run: string }>(
        'select public.start_production_run($1,1,null,null,$2)',
        [product, '2026-09-23'],
      );
      return r.rows[0]!.start_production_run;
    });
    await t.asUser(owner, async () => {
      await t.db.query('select public.complete_production_run($1,null,1,0)', [id]);
      await expect(
        t.db.query('select public.reverse_production_run($1,$2)', [id, '   ']),
      ).rejects.toThrow(/reason/i);
      await t.db.query('select public.reverse_production_run($1,$2)', [id, 'Wrong product']);
      await expect(
        t.db.query('select public.reverse_production_run($1,$2)', [id, 'Again']),
      ).rejects.toThrow(/only a completed run/i);
    });
  });
});

describe('what a run refuses', () => {
  it('refuses to consume stock that is not there', async () => {
    const scarce = await item('Scarce filament', gram);
    await t.asUser(owner, async () => {
      await t.db.query(`select public.record_opening_balance($1,10,1.00,'2026-09-01')`, [scarce]);
    });
    const other = await t.asUser(owner, async () => {
      const r = await t.db.query<{ create_product: string }>(
        'select public.create_product($1,$2,$3,$4,$5)',
        [org, 'Scarce product', 'SCARCE-1', piece, '0'],
      );
      return r.rows[0]!.create_product;
    });
    await t.asUser(owner, async () => {
      await t.db.query('select public.save_product_recipe($1,$2::jsonb,null)', [
        other,
        JSON.stringify([
          {
            line_type: 'material',
            ref_item_id: scarce,
            qty_per_unit: '100',
            unit_id: gram,
            waste_rate: '0',
          },
        ]),
      ]);
    });
    const id = await t.asUser(owner, async () => {
      const r = await t.db.query<{ start_production_run: string }>(
        'select public.start_production_run($1,1)',
        [other],
      );
      return r.rows[0]!.start_production_run;
    });
    await t.asUser(owner, async () => {
      await expect(
        t.db.query('select public.complete_production_run($1,null,1,0)', [id]),
      ).rejects.toThrow(/Scarce filament/);
    });
    // And nothing was written: the whole completion is one transaction.
    const after = await balance(scarce);
    expect(toDecimal(after.qty_on_hand).toFixed(0)).toBe('10');
    expect((await run(id)).status).toBe('in_progress');
  });
});
