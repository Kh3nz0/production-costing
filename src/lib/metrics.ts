import 'server-only';
import { monthOf, rollingYearTo, type Period } from './metrics-periods';
import { createClient } from './supabase/server';
import { Money } from './money';
import { fromInteger, toDecimal } from './decimal';
import type Decimal from 'decimal.js';
import { VAT_THRESHOLD } from './metrics-periods';

/**
 * Every figure the dashboard shows, computed once, here.
 *
 * S10's done-when is "no card without a report behind it". The way that is kept
 * true is that the cards do not compute anything: each figure is a function in
 * this module, and S11's reports call the same functions. A card and a report
 * cannot disagree if there is only one definition.
 *
 * Paging: every list query ends its order chain with a unique column, because
 * PostgREST caps a response at 1000 rows and `.limit()` cannot raise it (D-080).
 */

export interface InventoryTotal {
  value: Money;
  items: number;
  uncosted: number;
}

export async function inventoryValue(orgId: string): Promise<InventoryTotal> {
  const db = await createClient();
  const { data, error } = await db
    .from('items')
    .select('id,qty_on_hand::text,avg_unit_cost::text')
    .eq('org_id', orgId)
    .is('archived_at', null)
    .order('id')
    .range(0, 999);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    qty_on_hand: string;
    avg_unit_cost: string | null;
  }[];
  const held = rows.filter((row) => toDecimal(row.qty_on_hand).gt(0));
  return {
    // Stock whose cost nobody has established contributes nothing rather than
    // zero, and the count of those is shown beside the total (D-119).
    value: Money.sum(
      held
        .filter((row) => row.avg_unit_cost !== null)
        .map((row) => Money.fromDecimal(toDecimal(row.qty_on_hand).times(row.avg_unit_cost!))),
    ),
    items: held.length,
    uncosted: held.filter((row) => row.avg_unit_cost === null).length,
  };
}

export interface RunTotals {
  cost: Money;
  loss: Money;
  runs: number;
  unitsStarted: number;
  unitsFailed: number;
  failureRate: Decimal | null;
}

export async function productionTotals(orgId: string, period: Period): Promise<RunTotals> {
  const db = await createClient();
  const { data, error } = await db
    .from('production_runs')
    .select('id,actual_total_cost_cents::text,abnormal_loss_cents::text,units_started,units_failed')
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .gte('run_date', period.from)
    .lte('run_date', period.to)
    .order('run_date')
    .order('id')
    .range(0, 999);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    actual_total_cost_cents: string | null;
    abnormal_loss_cents: string | null;
    units_started: number | null;
    units_failed: number | null;
  }[];
  const started = rows.reduce((total, row) => total + (row.units_started ?? 0), 0);
  const failed = rows.reduce((total, row) => total + (row.units_failed ?? 0), 0);
  return {
    cost: Money.sum(
      rows.map((row) => Money.fromCentavos(BigInt(row.actual_total_cost_cents ?? '0'))),
    ),
    loss: Money.sum(rows.map((row) => Money.fromCentavos(BigInt(row.abnormal_loss_cents ?? '0')))),
    runs: rows.length,
    unitsStarted: started,
    unitsFailed: failed,
    // A plain unit count across products, and labelled as such: it weights a
    // ₱30 keychain the same as a ₱600 build (F-16).
    failureRate: started === 0 ? null : fromInteger(failed).dividedBy(fromInteger(started)),
  };
}

export interface SalesTotals {
  revenue: Money;
  netRevenue: Money;
  contribution: Money | null;
  contributionMargin: Decimal | null;
  sales: number;
  withUnknownCost: number;
}

export async function salesTotals(orgId: string, period: Period): Promise<SalesTotals> {
  const db = await createClient();
  const { data, error } = await db
    .from('sales')
    .select('id,revenue_cents::text,net_revenue_cents::text,contribution_profit_cents::text')
    .eq('org_id', orgId)
    .gte('sale_date', period.from)
    .lte('sale_date', period.to)
    .order('sale_date')
    .order('id')
    .range(0, 999);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    revenue_cents: string;
    net_revenue_cents: string;
    contribution_profit_cents: string | null;
  }[];
  const unknown = rows.filter((row) => row.contribution_profit_cents === null).length;
  const netRevenue = Money.sum(
    rows.map((row) => Money.fromCentavos(BigInt(row.net_revenue_cents))),
  );
  // One sale of unknown cost makes the month's contribution unknown, for the
  // same reason one uncosted line makes a sale's cost unknown (D-119).
  const contribution =
    unknown > 0
      ? null
      : Money.sum(
          rows.map((row) => Money.fromCentavos(BigInt(row.contribution_profit_cents ?? '0'))),
        );
  return {
    revenue: Money.sum(rows.map((row) => Money.fromCentavos(BigInt(row.revenue_cents)))),
    netRevenue,
    contribution,
    contributionMargin:
      contribution === null || !netRevenue.toDecimal().gt(0)
        ? null
        : contribution.toDecimal().dividedBy(netRevenue.toDecimal()),
    sales: rows.length,
    withUnknownCost: unknown,
  };
}

/**
 * Waste as a share of value, never of quantity: a quantity ratio across items
 * would add grams to pieces, which is the same defect that makes allocation by
 * quantity invalid across mixed units (F-16, D-032).
 */
export async function wasteRate(
  orgId: string,
  period: Period,
): Promise<{ wasted: Money; consumed: Money; rate: Decimal | null }> {
  const db = await createClient();
  const { data, error } = await db
    .from('inventory_movements')
    .select('id,movement_type,cost_effect_cents::text')
    .eq('org_id', orgId)
    .in('movement_type', ['waste', 'damage', 'production_consumption'])
    .gte('occurred_at', `${period.from}T00:00:00Z`)
    .lte('occurred_at', `${period.to}T23:59:59Z`)
    .order('occurred_at')
    .order('id')
    .range(0, 999);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    movement_type: string;
    cost_effect_cents: string | null;
  }[];
  const value = (types: string[]) =>
    Money.sum(
      rows
        .filter((row) => types.includes(row.movement_type) && row.cost_effect_cents !== null)
        .map((row) => Money.fromCentavos(BigInt(row.cost_effect_cents!)).negated()),
    );
  const wasted = value(['waste', 'damage']);
  const consumed = value(['production_consumption']).plus(wasted);
  return {
    wasted,
    consumed,
    rate: !consumed.toDecimal().gt(0) ? null : wasted.toDecimal().dividedBy(consumed.toDecimal()),
  };
}

export interface LowStockRow {
  id: string;
  name: string;
  qty_on_hand: string;
  reorder_point: string;
  unit: string | null;
}

export async function lowStock(orgId: string): Promise<LowStockRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('items')
    .select(
      'id,name,qty_on_hand::text,reorder_point::text,base_unit:units!items_base_unit_id_fkey(code)',
    )
    .eq('org_id', orgId)
    .is('archived_at', null)
    .not('reorder_point', 'is', null)
    .order('name')
    .order('id')
    .range(0, 999);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as unknown as {
      id: string;
      name: string;
      qty_on_hand: string;
      reorder_point: string | null;
      base_unit: { code: string } | null;
    }[]
  )
    .filter(
      (row) =>
        row.reorder_point !== null && toDecimal(row.qty_on_hand).lte(toDecimal(row.reorder_point)),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      qty_on_hand: row.qty_on_hand,
      reorder_point: row.reorder_point!,
      unit: row.base_unit?.code ?? null,
    }));
}

/** What the month's contribution has covered of the overhead pool it has to carry. */
export async function overheadRecovery(
  orgId: string,
  period: Period,
  contribution: Money | null,
): Promise<{ pool: Money; recovered: Money | null; ratio: Decimal | null } | null> {
  const db = await createClient();
  const { data, error } = await db
    .from('overhead_versions')
    .select('id,effective_from,monthly_pool_cents::text')
    .eq('org_id', orgId)
    .lte('effective_from', period.to)
    .order('effective_from', { ascending: false })
    .order('id', { ascending: false })
    .range(0, 0);
  if (error) throw new Error(error.message);
  const rule = ((data ?? []) as unknown as { monthly_pool_cents: string }[])[0];
  if (!rule) return null;
  const pool = Money.fromCentavos(BigInt(rule.monthly_pool_cents));
  return {
    pool,
    recovered: contribution,
    ratio:
      contribution === null || !pool.toDecimal().gt(0)
        ? null
        : contribution.toDecimal().dividedBy(pool.toDecimal()),
  };
}

/** A count of recorded sales against the registration threshold. Not tax advice. */
export { VAT_THRESHOLD, monthOf, rollingYearTo, type Period };

export async function vatThreshold(
  orgId: string,
  asOf: string,
): Promise<{ revenue: Money; ratio: Decimal }> {
  const totals = await salesTotals(orgId, rollingYearTo(asOf));
  return {
    revenue: totals.revenue,
    ratio: totals.revenue.toDecimal().dividedBy(VAT_THRESHOLD.toDecimal()),
  };
}

/** What is not set up yet, named rather than guessed around. */
export async function setupGaps(orgId: string): Promise<string[]> {
  const db = await createClient();
  const counts = await Promise.all(
    (
      [
        ['utility_rates', 'Electricity rate not set'],
        ['equipment', 'No equipment recorded'],
        ['labor_activities', 'No labour activities'],
        ['overhead_versions', 'Overhead not set'],
        ['sales_channels', 'No sales channels'],
      ] as const
    ).map(async ([table, label]) => {
      const { count, error } = await db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId);
      if (error) throw new Error(error.message);
      return (count ?? 0) === 0 ? (label as string) : null;
    }),
  );
  return counts.filter((label): label is string => label !== null);
}
