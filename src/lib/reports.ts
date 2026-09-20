import 'server-only';
import { createClient } from './supabase/server';
import { Money } from './money';
import { formatPercent, formatQuantity, formatRate, toDecimal } from './decimal';
import { movementLabel, type MovementType } from './stock-types';
import type { Cell, ReportResult } from './report-types';
import type { Period } from './metrics-periods';

/**
 * The twelve reports, one function each.
 *
 * Each returns rows in both forms at once — display text and CSV data — so the
 * export cannot drift from the screen: there is one query, one set of rows and
 * one total, rendered twice (S11's done-when).
 *
 * Every query pages with `.range()` and ends its order chain with a unique
 * column. PostgREST caps a response at 1000 rows and `.limit()` cannot raise
 * it, and paging over a non-unique sort returns rows in a different order per
 * page — duplicating some and skipping others (D-080).
 */

export const PAGE_SIZE = 100;

function text(value: string, align?: 'right'): Cell {
  return align ? { text: value, data: value, align } : { text: value, data: value };
}
function money(amount: Money): Cell {
  // Display form on screen, data form in the CSV: the same number (F-68).
  return { text: amount.format(), data: amount.toJSON(), align: 'right' };
}
function maybeMoney(amount: Money | null, absent = 'Unknown'): Cell {
  return amount === null ? { text: absent, data: '', align: 'right' } : money(amount);
}
function quantity(value: string, unit?: string): Cell {
  return { text: formatQuantity(value, unit), data: toDecimal(value).toString(), align: 'right' };
}
function rate(value: string | null): Cell {
  return value === null
    ? { text: '—', data: '', align: 'right' }
    : { text: formatRate(value), data: toDecimal(value).toString(), align: 'right' };
}
function percent(value: import('decimal.js').Decimal | null): Cell {
  return value === null
    ? { text: '—', data: '', align: 'right' }
    : { text: formatPercent(value), data: value.toFixed(6), align: 'right' };
}
function cents(value: string | null): Money | null {
  return value === null ? null : Money.fromCentavos(BigInt(value));
}

interface Args {
  orgId: string;
  period: Period | null;
  page: number;
  asOf: string;
}

type Runner = (args: Args) => Promise<ReportResult>;

const from = (args: Args) => args.page * PAGE_SIZE;
const to = (args: Args) => args.page * PAGE_SIZE + PAGE_SIZE; // one extra, to know if more exist
const trim = (rows: unknown[]) => rows.length > PAGE_SIZE;

async function inventoryOnHand(args: Args): Promise<ReportResult> {
  const db = await createClient();
  const { data, error } = await db
    .from('items')
    .select(
      'id,name,sku,item_type,qty_on_hand::text,avg_unit_cost::text,base_unit:units!items_base_unit_id_fkey(code)',
    )
    .eq('org_id', args.orgId)
    .is('archived_at', null)
    .order('name')
    .order('id')
    .range(from(args), to(args));
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as {
    name: string;
    sku: string | null;
    item_type: string;
    qty_on_hand: string;
    avg_unit_cost: string | null;
    base_unit: { code: string } | null;
  }[];
  const hasMore = trim(all);
  const rows = all.slice(0, PAGE_SIZE);
  const value = (row: (typeof rows)[number]) =>
    row.avg_unit_cost === null
      ? null
      : Money.fromDecimal(toDecimal(row.qty_on_hand).times(row.avg_unit_cost));
  const uncosted = rows.filter((row) => row.avg_unit_cost === null).length;
  return {
    columns: ['Item', 'SKU', 'Type', 'On hand', 'Unit cost', 'Value'],
    rows: rows.map((row) => [
      text(row.name),
      text(row.sku ?? ''),
      text(row.item_type.replaceAll('_', ' ')),
      quantity(row.qty_on_hand, row.base_unit?.code),
      rate(row.avg_unit_cost),
      maybeMoney(value(row)),
    ]),
    totals: [
      text('Total'),
      text(''),
      text(''),
      text(''),
      text(''),
      money(Money.sum(rows.map(value).filter((v): v is Money => v !== null))),
    ],
    hasMore,
    ...(uncosted > 0
      ? {
          notes: [
            `${uncosted} ${uncosted === 1 ? 'item has' : 'items have'} no established cost and contribute nothing to the total, rather than zero.`,
          ],
        }
      : {}),
  };
}

async function inventoryMovements(args: Args): Promise<ReportResult> {
  const db = await createClient();
  let query = db
    .from('inventory_movements')
    .select(
      'id,occurred_at,movement_type,quantity_change::text,resulting_qty::text,unit_cost_at_movement::text,cost_effect_cents::text,reason,source_table,item:items!inventory_movements_item_id_fkey(name,base_unit:units!items_base_unit_id_fkey(code))',
    )
    .eq('org_id', args.orgId);
  if (args.period) {
    query = query
      .gte('occurred_at', `${args.period.from}T00:00:00Z`)
      .lte('occurred_at', `${args.period.to}T23:59:59Z`);
  }
  const { data, error } = await query
    .order('occurred_at', { ascending: false })
    .order('seq', { ascending: false })
    .range(from(args), to(args));
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as {
    occurred_at: string;
    movement_type: string;
    quantity_change: string;
    resulting_qty: string;
    unit_cost_at_movement: string | null;
    cost_effect_cents: string | null;
    reason: string | null;
    source_table: string | null;
    item: { name: string; base_unit: { code: string } | null } | null;
  }[];
  const hasMore = trim(all);
  const rows = all.slice(0, PAGE_SIZE);
  return {
    columns: ['Date', 'Item', 'Type', 'Change', 'Balance after', 'Unit cost', 'Value', 'Why'],
    rows: rows.map((row) => [
      text(row.occurred_at.slice(0, 10)),
      text(row.item?.name ?? ''),
      text(movementLabel(row.movement_type as MovementType)),
      quantity(row.quantity_change, row.item?.base_unit?.code),
      quantity(row.resulting_qty, row.item?.base_unit?.code),
      rate(row.unit_cost_at_movement),
      maybeMoney(cents(row.cost_effect_cents), '—'),
      text(row.reason ?? row.source_table ?? ''),
    ]),
    hasMore,
  };
}

async function inventoryValuation(args: Args): Promise<ReportResult> {
  const db = await createClient();
  const { data, error } = await db.rpc('inventory_valuation', {
    p_org_id: args.orgId,
    p_as_of: `${args.period?.to ?? args.asOf}T23:59:59Z`,
  });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as {
    item_name: string;
    unit_code: string;
    quantity: string | number;
    unit_cost: string | number | null;
    value_cents: string | number | null;
  }[];
  const held = all.filter((row) => toDecimal(String(row.quantity)).gt(0));
  const rows = held.slice(from(args), from(args) + PAGE_SIZE);
  const value = (row: (typeof rows)[number]) =>
    row.value_cents === null ? null : Money.fromCentavos(BigInt(String(row.value_cents)));
  return {
    columns: ['Item', 'Quantity', 'Unit cost', 'Value'],
    rows: rows.map((row) => [
      text(row.item_name),
      quantity(String(row.quantity), row.unit_code),
      rate(row.unit_cost === null ? null : String(row.unit_cost)),
      maybeMoney(value(row)),
    ]),
    totals: [
      text('Total'),
      text(''),
      text(''),
      money(Money.sum(rows.map(value).filter((v): v is Money => v !== null))),
    ],
    hasMore: held.length > from(args) + PAGE_SIZE,
    notes: [
      `As of ${args.period?.to ?? args.asOf}. Each item's figure is the balance and average stored on its last movement on or before that date, not a replay of the ledger.`,
    ],
  };
}

async function purchaseHistory(args: Args): Promise<ReportResult> {
  const db = await createClient();
  const query = db
    .from('purchase_lines')
    .select(
      'id,qty_received::text,receipt_unit_cost::text,landed_total_cents::text,item:items!purchase_lines_item_id_fkey(name),purchase:purchases!purchase_lines_purchase_id_fkey(purchase_date,reference_no,status,supplier:suppliers(name))',
    )
    .eq('org_id', args.orgId);
  const { data, error } = await query.order('id').range(from(args), to(args));
  if (error) throw new Error(error.message);
  const all = (
    (data ?? []) as unknown as {
      qty_received: string | null;
      receipt_unit_cost: string | null;
      landed_total_cents: string | null;
      item: { name: string } | null;
      purchase: {
        purchase_date: string;
        reference_no: string | null;
        status: string;
        supplier: { name: string } | null;
      } | null;
    }[]
  ).filter(
    (row) =>
      row.purchase !== null &&
      (!args.period ||
        (row.purchase.purchase_date >= args.period.from &&
          row.purchase.purchase_date <= args.period.to)),
  );
  const hasMore = trim(all);
  const rows = all.slice(0, PAGE_SIZE);
  return {
    columns: ['Date', 'Reference', 'Supplier', 'Item', 'Quantity', 'Unit cost', 'Landed total'],
    rows: rows.map((row) => [
      text(row.purchase!.purchase_date),
      text(row.purchase!.reference_no ?? ''),
      text(row.purchase!.supplier?.name ?? ''),
      text(row.item?.name ?? ''),
      quantity(row.qty_received ?? '0'),
      rate(row.receipt_unit_cost),
      maybeMoney(cents(row.landed_total_cents), '—'),
    ]),
    totals: [
      text('Total'),
      text(''),
      text(''),
      text(''),
      text(''),
      text(''),
      money(
        Money.sum(
          rows.map((row) => cents(row.landed_total_cents)).filter((v): v is Money => v !== null),
        ),
      ),
    ],
    hasMore,
  };
}

async function productionHistory(args: Args): Promise<ReportResult> {
  const db = await createClient();
  let query = db
    .from('production_runs')
    .select(
      'id,run_date,status,units_started,units_accepted,units_failed,actual_total_cost_cents::text,abnormal_loss_cents::text,actual_cost_per_accepted_unit::text,estimated_unit_cost::text,item:items!production_runs_org_id_item_id_fkey(name)',
    )
    .eq('org_id', args.orgId);
  if (args.period) {
    query = query.gte('run_date', args.period.from).lte('run_date', args.period.to);
  }
  const { data, error } = await query
    .order('run_date', { ascending: false })
    .order('id', { ascending: false })
    .range(from(args), to(args));
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as {
    run_date: string;
    status: string;
    units_started: number | null;
    units_accepted: number | null;
    units_failed: number | null;
    actual_total_cost_cents: string | null;
    abnormal_loss_cents: string | null;
    actual_cost_per_accepted_unit: string | null;
    estimated_unit_cost: string | null;
    item: { name: string } | null;
  }[];
  const hasMore = trim(all);
  const rows = all.slice(0, PAGE_SIZE);
  return {
    columns: [
      'Date',
      'Product',
      'Status',
      'Started',
      'Accepted',
      'Failed',
      'Run cost',
      'Production loss',
      'Cost per accepted unit',
    ],
    rows: rows.map((row) => [
      text(row.run_date),
      text(row.item?.name ?? ''),
      text(row.status.replaceAll('_', ' ')),
      text(String(row.units_started ?? ''), 'right'),
      text(String(row.units_accepted ?? ''), 'right'),
      text(String(row.units_failed ?? ''), 'right'),
      maybeMoney(cents(row.actual_total_cost_cents), '—'),
      maybeMoney(cents(row.abnormal_loss_cents), '—'),
      rate(row.actual_cost_per_accepted_unit),
    ]),
    totals: [
      text('Total'),
      text(''),
      text(''),
      text(''),
      text(''),
      text(''),
      money(
        Money.sum(
          rows
            .map((row) => cents(row.actual_total_cost_cents))
            .filter((v): v is Money => v !== null),
        ),
      ),
      money(
        Money.sum(
          rows.map((row) => cents(row.abnormal_loss_cents)).filter((v): v is Money => v !== null),
        ),
      ),
      text(''),
    ],
    hasMore,
  };
}

async function estimatedVersusActual(args: Args): Promise<ReportResult> {
  const base = await productionHistory({ ...args, page: args.page });
  const db = await createClient();
  let query = db
    .from('production_runs')
    .select(
      'id,run_date,units_accepted,actual_cost_per_accepted_unit::text,estimated_unit_cost::text,item:items!production_runs_org_id_item_id_fkey(name)',
    )
    .eq('org_id', args.orgId)
    .eq('status', 'completed');
  if (args.period) {
    query = query.gte('run_date', args.period.from).lte('run_date', args.period.to);
  }
  const { data, error } = await query
    .order('run_date', { ascending: false })
    .order('id', { ascending: false })
    .range(from(args), to(args));
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as {
    run_date: string;
    actual_cost_per_accepted_unit: string | null;
    estimated_unit_cost: string | null;
    item: { name: string } | null;
  }[];
  const rows = all.slice(0, PAGE_SIZE);
  return {
    columns: ['Date', 'Product', 'Estimated per unit', 'Actual per unit', 'Difference', 'Variance'],
    rows: rows.map((row) => {
      const estimate = row.estimated_unit_cost === null ? null : toDecimal(row.estimated_unit_cost);
      const actual =
        row.actual_cost_per_accepted_unit === null
          ? null
          : toDecimal(row.actual_cost_per_accepted_unit);
      const difference = estimate === null || actual === null ? null : actual.minus(estimate);
      return [
        text(row.run_date),
        text(row.item?.name ?? ''),
        rate(row.estimated_unit_cost),
        rate(row.actual_cost_per_accepted_unit),
        difference === null
          ? { text: '—', data: '', align: 'right' as const }
          : {
              text: formatRate(difference),
              data: difference.toString(),
              align: 'right' as const,
            },
        percent(
          difference === null || estimate === null || !estimate.gt(0)
            ? null
            : difference.dividedBy(estimate),
        ),
      ];
    }),
    hasMore: base.hasMore,
    notes: [
      'Each run is compared against the estimate as it stood when the run started, not against today’s estimate. Comparing against a current estimate would make past variance change every time a price moved.',
    ],
  };
}

async function failuresAndWaste(args: Args): Promise<ReportResult> {
  const db = await createClient();
  let query = db
    .from('inventory_movements')
    .select(
      'id,occurred_at,movement_type,quantity_change::text,cost_effect_cents::text,reason,item:items!inventory_movements_item_id_fkey(name,base_unit:units!items_base_unit_id_fkey(code))',
    )
    .eq('org_id', args.orgId)
    .in('movement_type', ['waste', 'damage', 'production_failure']);
  if (args.period) {
    query = query
      .gte('occurred_at', `${args.period.from}T00:00:00Z`)
      .lte('occurred_at', `${args.period.to}T23:59:59Z`);
  }
  const { data, error } = await query
    .order('occurred_at', { ascending: false })
    .order('seq', { ascending: false })
    .range(from(args), to(args));
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as {
    occurred_at: string;
    movement_type: string;
    quantity_change: string;
    cost_effect_cents: string | null;
    reason: string | null;
    item: { name: string; base_unit: { code: string } | null } | null;
  }[];
  const hasMore = trim(all);
  const rows = all.slice(0, PAGE_SIZE);
  const lost = (row: (typeof rows)[number]) =>
    row.cost_effect_cents === null
      ? null
      : Money.fromCentavos(BigInt(row.cost_effect_cents)).negated();
  return {
    columns: ['Date', 'Item', 'Type', 'Quantity', 'Value lost', 'Reason'],
    rows: rows.map((row) => [
      text(row.occurred_at.slice(0, 10)),
      text(row.item?.name ?? ''),
      text(movementLabel(row.movement_type as MovementType)),
      quantity(row.quantity_change, row.item?.base_unit?.code),
      maybeMoney(lost(row), '—'),
      text(row.reason ?? ''),
    ]),
    totals: [
      text('Total'),
      text(''),
      text(''),
      text(''),
      money(Money.sum(rows.map(lost).filter((v): v is Money => v !== null))),
      text(''),
    ],
    hasMore,
  };
}

/** Sales joined to their lines, used by the two profitability reports. */
async function saleRows(args: Args) {
  const db = await createClient();
  const query = db
    .from('sale_lines')
    .select(
      'id,quantity::text,unit_price_cents::text,line_discount_cents::text,line_cogs_cents::text,item:items!sale_lines_org_id_item_id_fkey(name),sale:sales!sale_lines_org_id_sale_id_fkey(sale_date,net_revenue_cents::text,revenue_cents::text,contribution_profit_cents::text,channel:sales_channels!sales_org_id_channel_id_fkey(name))',
    )
    .eq('org_id', args.orgId);
  const { data, error } = await query.order('id').range(0, 999);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as unknown as {
      quantity: string;
      unit_price_cents: string;
      line_discount_cents: string;
      line_cogs_cents: string | null;
      item: { name: string } | null;
      sale: {
        sale_date: string;
        net_revenue_cents: string;
        revenue_cents: string;
        contribution_profit_cents: string | null;
        channel: { name: string } | null;
      } | null;
    }[]
  ).filter(
    (row) =>
      row.sale !== null &&
      (!args.period ||
        (row.sale.sale_date >= args.period.from && row.sale.sale_date <= args.period.to)),
  );
}

async function salesByProduct(args: Args): Promise<ReportResult> {
  const lines = await saleRows(args);
  const byProduct = new Map<
    string,
    { quantity: import('decimal.js').Decimal; revenue: Money; cogs: Money | null }
  >();
  for (const line of lines) {
    const name = line.item?.name ?? '—';
    const revenue = Money.fromDecimal(
      Money.fromCentavos(BigInt(line.unit_price_cents)).timesExact(toDecimal(line.quantity)),
    ).minus(Money.fromCentavos(BigInt(line.line_discount_cents)));
    const cogs = cents(line.line_cogs_cents);
    const current = byProduct.get(name);
    byProduct.set(name, {
      quantity: (current?.quantity ?? toDecimal('0')).plus(toDecimal(line.quantity)),
      revenue: (current?.revenue ?? Money.ZERO).plus(revenue),
      // One uncosted line makes the product's cost unknown, not smaller (D-119).
      cogs:
        current?.cogs === null || cogs === null ? null : (current?.cogs ?? Money.ZERO).plus(cogs),
    });
  }
  const all = [...byProduct.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const rows = all.slice(from(args), from(args) + PAGE_SIZE);
  return {
    columns: ['Product', 'Units sold', 'Revenue', 'Cost of goods sold', 'Gross profit', 'Margin'],
    rows: rows.map(([name, totals]) => {
      const gross = totals.cogs === null ? null : totals.revenue.minus(totals.cogs);
      return [
        text(name),
        quantity(totals.quantity.toString()),
        money(totals.revenue),
        maybeMoney(totals.cogs),
        maybeMoney(gross),
        percent(
          gross === null || !totals.revenue.toDecimal().gt(0)
            ? null
            : gross.toDecimal().dividedBy(totals.revenue.toDecimal()),
        ),
      ];
    }),
    totals: [
      text('Total'),
      text(''),
      money(Money.sum(rows.map(([, t]) => t.revenue))),
      maybeMoney(
        rows.some(([, t]) => t.cogs === null)
          ? null
          : Money.sum(rows.map(([, t]) => t.cogs as Money)),
      ),
      text(''),
      text(''),
    ],
    hasMore: all.length > from(args) + PAGE_SIZE,
  };
}

async function profitabilityByChannel(args: Args): Promise<ReportResult> {
  const db = await createClient();
  let query = db
    .from('sales')
    .select(
      'id,sale_date,revenue_cents::text,net_revenue_cents::text,contribution_profit_cents::text,commission_fee_cents::text,payment_fee_cents::text,channel:sales_channels!sales_org_id_channel_id_fkey(name)',
    )
    .eq('org_id', args.orgId);
  if (args.period) {
    query = query.gte('sale_date', args.period.from).lte('sale_date', args.period.to);
  }
  const { data, error } = await query.order('sale_date').order('id').range(0, 999);
  if (error) throw new Error(error.message);
  const sales = (data ?? []) as unknown as {
    revenue_cents: string;
    net_revenue_cents: string;
    contribution_profit_cents: string | null;
    commission_fee_cents: string;
    payment_fee_cents: string;
    channel: { name: string } | null;
  }[];
  const byChannel = new Map<
    string,
    { sales: number; revenue: Money; fees: Money; net: Money; contribution: Money | null }
  >();
  for (const sale of sales) {
    const name = sale.channel?.name ?? 'Direct';
    const current = byChannel.get(name);
    const contribution = cents(sale.contribution_profit_cents);
    byChannel.set(name, {
      sales: (current?.sales ?? 0) + 1,
      revenue: (current?.revenue ?? Money.ZERO).plus(
        Money.fromCentavos(BigInt(sale.revenue_cents)),
      ),
      fees: (current?.fees ?? Money.ZERO)
        .plus(Money.fromCentavos(BigInt(sale.commission_fee_cents)))
        .plus(Money.fromCentavos(BigInt(sale.payment_fee_cents))),
      net: (current?.net ?? Money.ZERO).plus(Money.fromCentavos(BigInt(sale.net_revenue_cents))),
      contribution:
        current?.contribution === null || contribution === null
          ? null
          : (current?.contribution ?? Money.ZERO).plus(contribution),
    });
  }
  const all = [...byChannel.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const rows = all.slice(from(args), from(args) + PAGE_SIZE);
  return {
    columns: [
      'Channel',
      'Sales',
      'Revenue',
      'Fees',
      'Net revenue',
      'Contribution profit',
      'Margin',
    ],
    rows: rows.map(([name, t]) => [
      text(name),
      text(String(t.sales), 'right'),
      money(t.revenue),
      money(t.fees),
      money(t.net),
      maybeMoney(t.contribution),
      percent(
        t.contribution === null || !t.net.toDecimal().gt(0)
          ? null
          : t.contribution.toDecimal().dividedBy(t.net.toDecimal()),
      ),
    ]),
    totals: [
      text('Total'),
      text(String(rows.reduce((n, [, t]) => n + t.sales, 0)), 'right'),
      money(Money.sum(rows.map(([, t]) => t.revenue))),
      money(Money.sum(rows.map(([, t]) => t.fees))),
      money(Money.sum(rows.map(([, t]) => t.net))),
      maybeMoney(
        rows.some(([, t]) => t.contribution === null)
          ? null
          : Money.sum(rows.map(([, t]) => t.contribution as Money)),
      ),
      text(''),
    ],
    hasMore: all.length > from(args) + PAGE_SIZE,
  };
}

async function supplierSpending(args: Args): Promise<ReportResult> {
  const db = await createClient();
  let query = db
    .from('purchases')
    .select(
      'id,purchase_date,supplier_shipping_cents::text,duties_cents::text,other_landed_cost_cents::text,discount_cents::text,supplier:suppliers(name),lines:purchase_lines(landed_total_cents::text)',
    )
    .eq('org_id', args.orgId);
  if (args.period) {
    query = query.gte('purchase_date', args.period.from).lte('purchase_date', args.period.to);
  }
  const { data, error } = await query.order('purchase_date').order('id').range(0, 999);
  if (error) throw new Error(error.message);
  const purchases = (data ?? []) as unknown as {
    supplier: { name: string } | null;
    lines: { landed_total_cents: string | null }[];
  }[];
  const bySupplier = new Map<string, { purchases: number; spent: Money }>();
  for (const purchase of purchases) {
    const name = purchase.supplier?.name ?? 'No supplier recorded';
    const current = bySupplier.get(name);
    bySupplier.set(name, {
      purchases: (current?.purchases ?? 0) + 1,
      spent: (current?.spent ?? Money.ZERO).plus(
        Money.sum(
          purchase.lines
            .map((line) => cents(line.landed_total_cents))
            .filter((v): v is Money => v !== null),
        ),
      ),
    });
  }
  const all = [...bySupplier.entries()].sort(
    (a, b) => b[1].spent.compare(a[1].spent) || a[0].localeCompare(b[0]),
  );
  const rows = all.slice(from(args), from(args) + PAGE_SIZE);
  return {
    columns: ['Supplier', 'Purchases', 'Landed spend'],
    rows: rows.map(([name, t]) => [text(name), text(String(t.purchases), 'right'), money(t.spent)]),
    totals: [
      text('Total'),
      text(String(rows.reduce((n, [, t]) => n + t.purchases, 0)), 'right'),
      money(Money.sum(rows.map(([, t]) => t.spent))),
    ],
    hasMore: all.length > from(args) + PAGE_SIZE,
  };
}

async function costChanges(args: Args): Promise<ReportResult> {
  const db = await createClient();
  let query = db
    .from('inventory_movements')
    .select(
      'id,occurred_at,resulting_avg_cost::text,item_id,item:items!inventory_movements_item_id_fkey(name)',
    )
    .eq('org_id', args.orgId)
    .not('resulting_avg_cost', 'is', null);
  if (args.period) {
    query = query
      .gte('occurred_at', `${args.period.from}T00:00:00Z`)
      .lte('occurred_at', `${args.period.to}T23:59:59Z`);
  }
  const { data, error } = await query.order('occurred_at').order('seq').range(0, 999);
  if (error) throw new Error(error.message);
  const movements = (data ?? []) as unknown as {
    item_id: string;
    resulting_avg_cost: string;
    item: { name: string } | null;
  }[];
  const byItem = new Map<string, { name: string; first: string; last: string }>();
  for (const movement of movements) {
    const current = byItem.get(movement.item_id);
    byItem.set(movement.item_id, {
      name: movement.item?.name ?? '—',
      first: current?.first ?? movement.resulting_avg_cost,
      last: movement.resulting_avg_cost,
    });
  }
  const all = [...byItem.values()]
    .map((entry) => {
      const first = toDecimal(entry.first);
      const last = toDecimal(entry.last);
      return {
        ...entry,
        change: last.minus(first),
        ratio: first.gt(0) ? last.dividedBy(first).minus(toDecimal('1')) : null,
      };
    })
    .filter((entry) => !entry.change.isZero())
    .sort((a, b) => b.change.abs().comparedTo(a.change.abs()) || a.name.localeCompare(b.name));
  const rows = all.slice(from(args), from(args) + PAGE_SIZE);
  return {
    columns: ['Item', 'Unit cost at start', 'Unit cost at end', 'Change', 'Change %'],
    rows: rows.map((entry) => [
      text(entry.name),
      rate(entry.first),
      rate(entry.last),
      { text: formatRate(entry.change), data: entry.change.toString(), align: 'right' as const },
      percent(entry.ratio),
    ]),
    hasMore: all.length > from(args) + PAGE_SIZE,
    notes: [
      'The first and last average cost recorded in the period, from the movements themselves. An item with no movement in the period does not appear.',
    ],
  };
}

async function productCostBreakdown(args: Args): Promise<ReportResult> {
  const { getProduct, getProductCost, listProducts } = await import('./products');
  // listProducts pages from 1; reports page from 0.
  const list = await listProducts(args.orgId, '', args.page + 1);
  const rows: Cell[][] = [];
  for (const summary of list.rows) {
    const product = await getProduct(summary.id, args.orgId);
    if (!product) continue;
    const cost = await getProductCost(product, args.period?.to ?? args.asOf);
    if (cost === null) {
      rows.push([
        text(product.name),
        text('No recipe'),
        { text: '—', data: '', align: 'right' },
        { text: '—', data: '', align: 'right' },
        { text: '—', data: '', align: 'right' },
      ]);
      continue;
    }
    for (const row of cost.rows) {
      rows.push([
        text(product.name),
        text(row.label),
        row.missing !== null
          ? { text: 'Missing', data: '', align: 'right' }
          : {
              text: formatRate(row.displayAmount ?? toDecimal('0')),
              data: (row.displayAmount ?? toDecimal('0')).toString(),
              align: 'right',
            },
        { text: '', data: '' },
        { text: '', data: '' },
      ]);
    }
    rows.push([
      text(product.name),
      text('Production cost per unit'),
      { text: '', data: '' },
      {
        text: formatRate(cost.displayInventory),
        data: cost.displayInventory.toString(),
        align: 'right',
      },
      {
        text: formatRate(cost.displayFull),
        data: cost.displayFull.toString(),
        align: 'right',
      },
    ]);
  }
  return {
    columns: ['Product', 'Component', 'Amount', 'Production cost', 'Full cost with overhead'],
    rows,
    hasMore: list.count > (args.page + 1) * PAGE_SIZE,
    notes: [
      `Costed with the rates in force on ${args.period?.to ?? args.asOf}. A missing rate is named rather than counted as zero.`,
    ],
  };
}

const RUNNERS: Record<string, Runner> = {
  'product-cost-breakdown': productCostBreakdown,
  'inventory-on-hand': inventoryOnHand,
  'inventory-movements': inventoryMovements,
  'inventory-valuation': inventoryValuation,
  'purchase-history': purchaseHistory,
  'supplier-spending': supplierSpending,
  'production-history': productionHistory,
  'failures-and-waste': failuresAndWaste,
  'sales-by-product': salesByProduct,
  'profitability-by-channel': profitabilityByChannel,
  'estimated-versus-actual': estimatedVersusActual,
  'cost-changes': costChanges,
};

export async function runReport(slug: string, args: Args): Promise<ReportResult | null> {
  const runner = RUNNERS[slug];
  return runner === undefined ? null : runner(args);
}
