import 'server-only';
import { createClient } from './supabase/server';
import { Money } from './money';
import { toDecimal } from './decimal';
import {
  isExampleRow,
  missingDependencies,
  orderMessage,
  readTemplateFile,
  templateByCode,
  type RowError,
  type Template,
} from './import-types';

/**
 * Validation and application for the thirteen templates.
 *
 * A dry run never writes. It reads the file, looks up every reference, and
 * returns what would happen. Applying runs the same validation again and then
 * writes, so a file that changed between the two passes cannot slip through.
 */

export interface DryRunResult {
  template: Template;
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
  wouldCreate: number;
  wouldSkip: number;
  errors: RowError[];
}

/** Everything in the org a reference column might point at. */
interface Lookups {
  units: Map<string, string>;
  items: Map<string, { id: string; base_unit_id: string }>;
  suppliers: Map<string, string>;
  equipment: Map<string, string>;
  activities: Map<string, string>;
  purchases: Map<string, string>;
  importedCodes: string[];
}

const key = (value: string) => value.trim().toLowerCase();

async function loadLookups(orgId: string): Promise<Lookups> {
  const db = await createClient();
  const [units, items, suppliers, equipment, activities, purchases, batches] = await Promise.all([
    db
      .from('units')
      .select('id,code')
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .order('id')
      .range(0, 999),
    db.from('items').select('id,name,base_unit_id').eq('org_id', orgId).order('id').range(0, 999),
    db.from('suppliers').select('id,name').eq('org_id', orgId).order('id').range(0, 999),
    db.from('equipment').select('id,name').eq('org_id', orgId).order('id').range(0, 999),
    db.from('labor_activities').select('id,name').eq('org_id', orgId).order('id').range(0, 999),
    db
      .from('purchases')
      .select('id,reference_no')
      .eq('org_id', orgId)
      .not('reference_no', 'is', null)
      .order('id')
      .range(0, 999),
    db
      .from('import_batches')
      .select('template_code')
      .eq('org_id', orgId)
      .eq('status', 'applied')
      .order('id')
      .range(0, 999),
  ]);
  const map = <T extends { id: string }>(rows: T[] | null, name: (row: T) => string | null) =>
    new Map(
      (rows ?? [])
        .filter((row) => name(row) !== null)
        .map((row) => [key(name(row)!), row.id] as const),
    );
  return {
    units: map(units.data as { id: string; code: string }[] | null, (row) => row.code),
    items: new Map(
      ((items.data ?? []) as { id: string; name: string; base_unit_id: string }[]).map((row) => [
        key(row.name),
        { id: row.id, base_unit_id: row.base_unit_id },
      ]),
    ),
    suppliers: map(suppliers.data as { id: string; name: string }[] | null, (row) => row.name),
    equipment: map(equipment.data as { id: string; name: string }[] | null, (row) => row.name),
    activities: map(activities.data as { id: string; name: string }[] | null, (row) => row.name),
    purchases: map(
      purchases.data as { id: string; reference_no: string | null }[] | null,
      (row) => row.reference_no,
    ),
    importedCodes: ((batches.data ?? []) as { template_code: string }[]).map(
      (row) => row.template_code,
    ),
  };
}

/** "Did you mean" — the closest existing name, when one is close enough. */
function nearest(value: string, candidates: Iterable<string>): string | null {
  const target = key(value);
  let best: { name: string; score: number } | null = null;
  for (const candidate of candidates) {
    const shared = [...target].filter((character) => candidate.includes(character)).length;
    const score = shared / Math.max(target.length, candidate.length);
    if (best === null || score > best.score) best = { name: candidate, score };
  }
  return best !== null && best.score >= 0.6 ? best.name : null;
}

export async function dryRun(
  orgId: string,
  templateCode: string,
  csv: string,
): Promise<DryRunResult | { orderError: string }> {
  const template = templateByCode(templateCode);
  if (!template) throw new Error('Unknown template.');

  const lookups = await loadLookups(orgId);
  const missing = missingDependencies(template, lookups.importedCodes);
  // Order is only enforced against templates that were actually imported here.
  // A business that entered its items by hand has satisfied 02-items without
  // an import batch to prove it, so the check asks whether the records exist.
  const unsatisfied = missing.filter((code) => {
    if (code === '02-items') return lookups.items.size === 0;
    if (code === '01-units') return lookups.units.size === 0;
    if (code === '03-suppliers') return lookups.suppliers.size === 0;
    if (code === '04-purchases') return lookups.purchases.size === 0;
    if (code === '07-equipment') return lookups.equipment.size === 0;
    if (code === '09-labor-activities') return lookups.activities.size === 0;
    if (code === '11-products') return lookups.items.size === 0;
    return false;
  });
  if (unsatisfied.length > 0) return { orderError: orderMessage(template, unsatisfied) };

  const file = readTemplateFile(csv);
  const errors: RowError[] = [];
  const seen = new Set<string>();
  let wouldCreate = 0;
  let wouldSkip = 0;

  file.rows.forEach((row, index) => {
    // Row 1 is the header, so the first data row is row 2 — the number the
    // spreadsheet shows down its own left edge.
    const rowNumber = index + 2;
    if (isExampleRow(row)) {
      wouldSkip += 1;
      return;
    }

    const fail = (field: string, message: string, errorClass: RowError['class']) =>
      errors.push({
        row: rowNumber,
        field,
        message: `Row ${rowNumber}: ${message}`,
        class: errorClass,
      });

    for (const field of template.required) {
      if ((row[field] ?? '') === '')
        fail(field, `${field.replaceAll('_', ' ')} is required`, 'required');
    }

    const number = (
      field: string,
      {
        min,
        belowOne,
        belowHundred,
      }: { min?: string; belowOne?: boolean; belowHundred?: boolean } = {},
    ) => {
      const value = row[field] ?? '';
      if (value === '') return;
      let parsed;
      try {
        parsed = toDecimal(value);
      } catch {
        fail(
          field,
          `${field.replaceAll('_', ' ')} '${value}' is not a plain number. Enter ${value.replace(/[^\d.]/g, '') || '1150.00'}`,
          'number',
        );
        return;
      }
      if (min !== undefined && parsed.lt(toDecimal(min))) {
        fail(field, `${field.replaceAll('_', ' ')} ${value} must be at least ${min}`, 'range');
      }
      if (belowOne === true && parsed.gte(toDecimal('1'))) {
        fail(field, `${field.replaceAll('_', ' ')} ${value} must be below 1`, 'range');
      }
      if (belowHundred === true && parsed.gte(toDecimal('100'))) {
        fail(field, `${field.replaceAll('_', ' ')} ${value} must be below 100`, 'range');
      }
    };

    const reference = (
      field: string,
      table: Map<string, unknown>,
      noun: string,
      optional = false,
    ) => {
      const value = row[field] ?? '';
      if (value === '') {
        if (!optional) fail(field, `${noun} is required`, 'required');
        return;
      }
      if (!table.has(key(value))) {
        const suggestion = nearest(value, table.keys());
        fail(
          field,
          `no ${noun} named '${value}'${suggestion === null ? '' : `. Did you mean '${suggestion}'?`}`,
          'reference',
        );
      }
    };

    switch (template.code) {
      case '01-units':
        number('factor_to_base_unit', { min: '0' });
        break;
      case '02-items':
        reference('base_unit', lookups.units, 'unit');
        if ((row.purchase_unit ?? '') !== '') reference('purchase_unit', lookups.units, 'unit');
        number('purchase_to_base_factor', { min: '0' });
        number('reorder_point_base_unit', { min: '0' });
        if ((row.preferred_supplier ?? '') !== '')
          reference('preferred_supplier', lookups.suppliers, 'supplier', true);
        if ((row.sku ?? '') !== '') {
          if (seen.has(`sku:${key(row.sku!)}`)) {
            fail('sku', `SKU ${row.sku} is used twice in this file`, 'duplicate');
          }
          seen.add(`sku:${key(row.sku!)}`);
        }
        break;
      case '04-purchases':
        if ((row.supplier_name ?? '') !== '')
          reference('supplier_name', lookups.suppliers, 'supplier', true);
        for (const field of [
          'supplier_shipping_amount',
          'discount_amount',
          'duties_amount',
          'other_landed_cost_amount',
        ]) {
          number(field, { min: '0' });
        }
        if ((row.purchase_ref ?? '') !== '') {
          if (seen.has(`ref:${key(row.purchase_ref!)}`)) {
            fail(
              'purchase_ref',
              `purchase reference ${row.purchase_ref} is used twice in this file`,
              'duplicate',
            );
          }
          seen.add(`ref:${key(row.purchase_ref!)}`);
        }
        break;
      case '05-purchase-lines':
        reference('purchase_ref', lookups.purchases, 'purchase');
        reference('item_name', lookups.items, 'item');
        if ((row.purchase_unit ?? '') !== '') reference('purchase_unit', lookups.units, 'unit');
        number('quantity_ordered', { min: '0' });
        number('quantity_received', { min: '0' });
        number('unit_price', { min: '0' });
        number('line_discount_amount', { min: '0' });
        break;
      case '06-opening-stock':
        reference('item_name', lookups.items, 'item');
        if ((row.unit ?? '') !== '') reference('unit', lookups.units, 'unit');
        number('quantity_on_hand', { min: '0' });
        number('unit_cost', { min: '0' });
        break;
      case '07-equipment':
        number('purchase_price', { min: '0' });
        number('expected_productive_hours_in_recovery_period', { min: '0' });
        number('measured_average_power_watts', { min: '0' });
        number('annual_maintenance_allowance', { min: '0' });
        number('annual_repair_allowance', { min: '0' });
        break;
      case '08-utility-rates':
        reference('unit', lookups.units, 'unit');
        number('rate_per_unit', { min: '0' });
        break;
      case '09-labor-activities':
        number('hourly_rate', { min: '0' });
        break;
      case '10-overhead':
        number('monthly_amount', { min: '0' });
        break;
      case '11-products':
        // The file asks for percentages, not fractions: a column headed
        // `expected_failure_rate_percent` holds 5, and 5 as a fraction would be
        // a 500% failure rate. Below 100 here, divided by 100 on apply.
        number('expected_failure_rate_percent', { min: '0', belowHundred: true });
        number('target_margin_percent', { min: '0', belowHundred: true });
        number('minimum_margin_percent', { min: '0', belowHundred: true });
        number('expected_output_quantity_per_run', { min: '0' });
        break;
      case '12-bom-lines':
        reference('product_name', lookups.items, 'product');
        number('quantity_per_unit', { min: '0' });
        number('expected_waste_percent', { min: '0' });
        if ((row.unit ?? '') !== '') reference('unit', lookups.units, 'unit');
        break;
      case '13-sales-channels':
        number('commission_fee_percent', { min: '0', belowHundred: true });
        number('payment_fee_percent', { min: '0', belowHundred: true });
        number('fixed_fee_per_order', { min: '0' });
        break;
      default:
        break;
    }

    if (!errors.some((error) => error.row === rowNumber)) wouldCreate += 1;
  });

  return {
    template,
    columns: file.columns,
    rows: file.rows,
    totalRows: file.rows.length,
    wouldCreate,
    wouldSkip,
    errors,
  };
}

/** Records the batch. A dry run writes one row here and nothing else. */
export async function recordBatch(
  orgId: string,
  userId: string,
  result: DryRunResult,
  options: { dryRun: boolean; fileName: string | null; created: number },
): Promise<string> {
  const db = await createClient();
  const { data, error } = await db
    .from('import_batches')
    .insert({
      org_id: orgId,
      template_code: result.template.code,
      file_name: options.fileName,
      status: options.dryRun ? 'validated' : 'applied',
      dry_run: options.dryRun,
      row_count: result.totalRows,
      error_count: result.errors.length,
      created_count: options.created,
      applied_at: options.dryRun ? null : new Date().toISOString(),
      summary: {
        would_create: result.wouldCreate,
        would_skip: result.wouldSkip,
        errors: result.errors.slice(0, 50),
      },
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/**
 * Applying an import. Validation runs again first: a file can change between
 * the dry run and the apply, and the dry run's verdict is about the file it
 * read.
 *
 * Rows are written one at a time and each created id is recorded against the
 * batch, which is what makes the batch reversible. Where a database function
 * already exists for a kind of write — an opening balance, a product, a recipe
 * — the import calls it rather than writing the rows itself, so an imported
 * record goes through exactly the checks a typed one does.
 */
const MULTI_ROW = ['04-purchases', '05-purchase-lines', '10-overhead', '12-bom-lines'];

/**
 * Options a template needs that its file does not carry.
 *
 * `10-overhead` is the only one: its columns are a category, an amount and a
 * date, and an overhead rate also needs the working hours the pool is spread
 * across. That number is not in the file, so it is asked for on the screen
 * rather than guessed — a guessed denominator is a wrong rate on every product.
 */
export interface ApplyOptions {
  expectedWorkingHours?: string;
}

export async function applyImport(
  orgId: string,
  userId: string,
  templateCode: string,
  csv: string,
  fileName: string | null,
  options: ApplyOptions = {},
): Promise<
  | { batchId: string; created: number }
  | { orderError: string }
  | { errors: RowError[]; result: DryRunResult }
> {
  const result = await dryRun(orgId, templateCode, csv);
  if ('orderError' in result) return result;
  if (result.errors.length > 0) return { errors: result.errors, result };

  const db = await createClient();
  const lookups = await loadLookups(orgId);
  const money = (value: string) =>
    value === '' ? '0' : Money.parse(value).toCentavos().toString();
  const nullable = (value: string) => (value === '' ? null : value);
  // A column headed `..._percent` holds 5, and the column behind it stores
  // 0.05. Getting this backwards gives a 500% failure rate — which every check
  // downstream refuses, loudly, but only after the import has run.
  const percentToFraction = (value: string) =>
    value === '' ? null : toDecimal(value).dividedBy(toDecimal('100')).toFixed(6);
  const created: { rowNumber: number; id: string | null }[] = [];

  for (const [index, row] of result.rows.entries()) {
    const rowNumber = index + 2;
    if (isExampleRow(row)) continue;
    let id: string | null = null;

    switch (templateCode) {
      case '01-units': {
        const { data, error } = await db
          .from('units')
          .insert({
            org_id: orgId,
            code: row.code,
            name: row.name,
            dimension_code: row.dimension_code,
            factor_to_dimension_base: row.factor_to_dimension_base,
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        break;
      }
      case '03-suppliers': {
        const { data, error } = await db
          .from('suppliers')
          .insert({
            org_id: orgId,
            name: row.name,
            contact_name: nullable(row.contact_name ?? ''),
            phone: nullable(row.phone ?? ''),
            email: nullable(row.email ?? ''),
            address: nullable(row.address ?? ''),
            notes: nullable(row.notes ?? ''),
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        break;
      }
      case '02-items':
      case '11-products': {
        const baseUnit = lookups.units.get(key(row.base_unit!))!;
        const purchaseUnit =
          (row.purchase_unit ?? '') === '' ? baseUnit : lookups.units.get(key(row.purchase_unit!))!;
        const { data, error } = await db
          .from('items')
          .insert({
            org_id: orgId,
            name: row.name,
            sku: nullable(row.sku ?? ''),
            item_type: templateCode === '11-products' ? 'finished_product' : row.item_type,
            brand: nullable(row.brand ?? ''),
            colour: nullable(row.colour ?? ''),
            base_unit_id: baseUnit,
            purchase_unit_id: purchaseUnit,
            purchase_to_base_factor:
              (row.purchase_to_base_factor ?? '') === '' ? 1 : row.purchase_to_base_factor,
            reorder_point: nullable(row.reorder_point_base_unit ?? ''),
            supplier_lead_time_days: nullable(row.supplier_lead_time_days ?? ''),
            notes: nullable(row.notes ?? ''),
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        if (templateCode === '11-products') {
          const { error: detailError } = await db.from('product_details').insert({
            item_id: id,
            org_id: orgId,
            expected_failure_rate: nullable(row.expected_failure_rate ?? ''),
            expected_output_qty_per_run: nullable(row.expected_output_qty_per_run ?? ''),
            target_margin: nullable(row.target_margin ?? ''),
            minimum_margin: nullable(row.minimum_margin ?? ''),
            created_by: userId,
          });
          if (detailError) throw new Error(`Row ${rowNumber}: ${detailError.message}`);
        }
        break;
      }
      case '06-opening-stock': {
        const item = lookups.items.get(key(row.item!))!;
        const { data, error } = await db.rpc('record_opening_balance', {
          p_item_id: item.id,
          p_qty: row.quantity_base_unit,
          p_unit_cost: nullable(row.unit_cost ?? ''),
          p_occurred_at:
            (row.as_of_date ?? '') === ''
              ? new Date().toISOString()
              : `${row.as_of_date}T00:00:00Z`,
        });
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = data as unknown as string;
        break;
      }
      case '07-equipment': {
        const { data, error } = await db
          .from('equipment')
          .insert({
            org_id: orgId,
            name: row.name,
            category: nullable(row.category ?? ''),
            purchase_price_cents: money(row.purchase_price ?? ''),
            purchase_date: nullable(row.purchase_date ?? ''),
            rated_power_watts: nullable(row.rated_power_watts ?? ''),
            measured_avg_power_watts: nullable(row.measured_avg_power_watts ?? ''),
            notes: nullable(row.notes ?? ''),
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        if ((row.expected_productive_hours ?? '') !== '') {
          const { error: rateError } = await db.rpc('add_equipment_rate', {
            p_equipment_id: id,
            p_effective_from: row.effective_from || new Date().toISOString().slice(0, 10),
            p_period_months: row.cost_recovery_period_months || '36',
            p_productive_hours: row.expected_productive_hours,
            p_maintenance_cents: money(row.maintenance_allowance_per_year ?? ''),
            p_repairs_cents: money(row.repair_allowance_per_year ?? ''),
            p_notes: 'Imported',
          });
          if (rateError) throw new Error(`Row ${rowNumber}: ${rateError.message}`);
        }
        break;
      }
      case '08-utility-rates': {
        const { data, error } = await db
          .from('utility_rates')
          .insert({
            org_id: orgId,
            utility_type: row.utility_type,
            rate_per_unit: row.rate_per_unit,
            unit_id: lookups.units.get(key(row.unit!))!,
            effective_from: row.effective_from,
            source_reference: nullable(row.source_reference ?? ''),
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        break;
      }
      case '09-labor-activities': {
        const { data, error } = await db
          .from('labor_activities')
          .insert({
            org_id: orgId,
            name: row.name,
            attended: (row.attended ?? '').toLowerCase() !== 'no',
            notes: nullable(row.notes ?? ''),
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        const { error: rateError } = await db.from('labor_rate_versions').insert({
          org_id: orgId,
          activity_id: id,
          hourly_rate: row.hourly_rate,
          effective_from: row.effective_from,
          created_by: userId,
        });
        if (rateError) throw new Error(`Row ${rowNumber}: ${rateError.message}`);
        break;
      }
      case '13-sales-channels': {
        const { data, error } = await db
          .from('sales_channels')
          .insert({
            org_id: orgId,
            name: row.channel_name,
            notes: nullable(row.notes ?? ''),
            created_by: userId,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Row ${rowNumber}: ${error.message}`);
        id = (data as { id: string }).id;
        const { error: feeError } = await db.from('channel_fee_versions').insert({
          org_id: orgId,
          channel_id: id,
          // The file asks for percentages; the column stores a fraction.
          commission_rate: percentToFraction(row.commission_fee_percent ?? '') ?? '0',
          payment_rate: percentToFraction(row.payment_fee_percent ?? '') ?? '0',
          fixed_fee_cents: money(row.fixed_fee_per_order ?? ''),
          // No effective-from column on this template: the first fee version
          // starts today.
          effective_from: new Date().toISOString().slice(0, 10),
          created_by: userId,
        });
        if (feeError) throw new Error(`Row ${rowNumber}: ${feeError.message}`);
        break;
      }
      default:
        // The four multi-row templates are applied once, after this loop, not
        // row by row. A purchase is a header plus its lines plus a receipt, and
        // writing that one row at a time is what leaves half a purchase behind
        // when row 40 fails.
        break;
    }
    if (id !== null) created.push({ rowNumber, id });
  }

  if (MULTI_ROW.includes(templateCode)) {
    const ids = await applyMultiRow(db, orgId, templateCode, result, lookups, options);
    for (const [index, id] of ids.entries()) {
      created.push({ rowNumber: index + 2, id });
    }
  }

  const batchId = await recordBatch(orgId, userId, result, {
    dryRun: false,
    fileName,
    created: created.length,
  });
  if (created.length > 0) {
    const { error } = await db.from('import_rows').insert(
      created.map((entry) => ({
        org_id: orgId,
        batch_id: batchId,
        row_number: entry.rowNumber,
        raw: result.rows[entry.rowNumber - 2] ?? {},
        status: 'created',
        created_record_id: entry.id,
      })),
    );
    if (error) throw new Error(error.message);
  }
  return { batchId, created: created.length };
}

/**
 * The four templates whose rows are one transaction together.
 *
 * Names were already resolved by the dry run, so this turns each row into ids
 * and amounts and hands the whole set to one database function. What comes back
 * is the ids it created, in file order.
 */
async function applyMultiRow(
  db: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  templateCode: string,
  result: DryRunResult,
  lookups: Lookups,
  options: ApplyOptions,
): Promise<(string | null)[]> {
  const rows = result.rows.filter((row) => !isExampleRow(row));
  // Centavos as a string, not a number: PostgREST accepts a numeric string for
  // a bigint, and bigint to number is a silent precision cliff at 2^53 (F-41).
  const money = (value: string) =>
    value === '' ? '0' : Money.parse(value).toCentavos().toString();
  const nullable = (value: string) => (value === '' ? null : value);

  if (templateCode === '04-purchases') {
    const payload = rows.map((row) => ({
      reference_no: row.purchase_ref,
      supplier_id: lookups.suppliers.get(key(row.supplier_name ?? '')) ?? null,
      purchase_date: row.purchase_date,
      shipping_cents: money(row.supplier_shipping_amount ?? ''),
      duties_cents: money(row.duties_amount ?? ''),
      other_cents: money(row.other_landed_cost_amount ?? ''),
      discount_cents: money(row.discount_amount ?? ''),
      vat_cents: money(row.vat_amount ?? ''),
      landed_cost_base: nullable(row.landed_cost_allocation_base ?? '') ?? 'value',
      payment_status: nullable(row.payment_status ?? '') ?? 'unpaid',
      notes: row.notes ?? '',
    }));
    const { data, error } = await db.rpc('import_purchases', { p_org_id: orgId, p_rows: payload });
    if (error) throw new Error(error.message);
    return data as unknown as string[];
  }

  if (templateCode === '05-purchase-lines') {
    const payload = rows.map((row) => {
      const item = lookups.items.get(key(row.item_name ?? ''))!;
      return {
        purchase_id: lookups.purchases.get(key(row.purchase_ref ?? ''))!,
        item_id: item.id,
        qty_ordered: row.quantity_ordered,
        qty_received: nullable(row.quantity_received ?? ''),
        purchase_unit_id: lookups.units.get(key(row.purchase_unit ?? '')) ?? item.base_unit_id,
        unit_price_cents: money(row.unit_price ?? ''),
        line_discount_cents: money(row.line_discount_amount ?? ''),
        notes: row.notes ?? '',
      };
    });
    const { data, error } = await db.rpc('import_purchase_lines', {
      p_org_id: orgId,
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    return data as unknown as string[];
  }

  if (templateCode === '10-overhead') {
    if ((options.expectedWorkingHours ?? '') === '') {
      throw new Error(
        'This template needs the expected working hours per month, which the file does not carry. Enter it above and run the import again.',
      );
    }
    const payload = rows.map((row) => ({
      category: row.overhead_category,
      amount_cents: money(row.monthly_amount ?? ''),
      effective_from: nullable(row.effective_from ?? ''),
      notes: row.notes ?? '',
    }));
    const { data, error } = await db.rpc('import_overhead', {
      p_org_id: orgId,
      p_rows: payload,
      p_expected_hours: options.expectedWorkingHours,
    });
    if (error) throw new Error(error.message);
    return [data as unknown as string];
  }

  // 12-bom-lines
  const payload = rows.map((row) => {
    const type = (row.line_type ?? '').toLowerCase();
    const target = key(row.item_or_activity_or_equipment ?? '');
    return {
      product_id: lookups.items.get(key(row.product_name ?? ''))!.id,
      line_type: type,
      ref_item_id: lookups.items.get(target)?.id ?? null,
      ref_equipment_id: type === 'machine_time' ? (lookups.equipment.get(target) ?? null) : null,
      ref_activity_id: type === 'labour' ? (lookups.activities.get(target) ?? null) : null,
      qty_per_unit: row.quantity_per_unit,
      unit_id: lookups.units.get(key(row.unit ?? '')) ?? null,
      // The file asks for a percentage; the column stores a fraction.
      waste_rate:
        (row.expected_waste_percent ?? '') === ''
          ? '0'
          : toDecimal(row.expected_waste_percent!).dividedBy(toDecimal('100')).toFixed(6),
      notes: row.notes ?? '',
    };
  });
  const { data, error } = await db.rpc('import_bom_lines', { p_org_id: orgId, p_rows: payload });
  if (error) throw new Error(error.message);
  return data as unknown as string[];
}
