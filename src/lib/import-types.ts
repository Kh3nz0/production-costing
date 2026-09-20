/**
 * The thirteen import templates, the order they must be imported in, and the
 * validation vocabulary. Pure, so it can be tested: the writers live in
 * `importer.ts`, which is server-only.
 *
 * Four principles from the specification shape all of this.
 *
 * 1. **A dry run never writes.** The first pass validates every row and reports
 *    what would happen.
 * 2. **The error file is the file you uploaded**, plus two columns, so a fix is
 *    made in the spreadsheet already open rather than transcribed off a screen.
 * 3. **Order is enforced and named.** A template whose dependencies are not
 *    there is refused with the order to follow.
 * 4. **An applied batch is reversible.**
 */

export type ErrorClass =
  'required' | 'reference' | 'number' | 'range' | 'unit' | 'duplicate' | 'consistency' | 'order';

export interface RowError {
  row: number;
  field: string;
  message: string;
  class: ErrorClass;
}

export interface Template {
  code: string;
  title: string;
  /** The order the specification gives. A lower number must be imported first. */
  order: number;
  creates: string;
  dependsOn: string[];
  columns: string[];
  required: string[];
}

export const TEMPLATES: Template[] = [
  {
    code: '01-units',
    title: 'Units',
    order: 1,
    creates: 'units',
    dependsOn: [],
    columns: [
      'unit_code',
      'unit_name',
      'dimension',
      'is_base_unit_for_dimension',
      'factor_to_base_unit',
      'notes',
    ],
    required: ['unit_code', 'unit_name', 'dimension', 'factor_to_base_unit'],
  },
  {
    code: '03-suppliers',
    title: 'Suppliers',
    order: 2,
    creates: 'suppliers',
    dependsOn: [],
    columns: [
      'supplier_name',
      'contact_person',
      'phone',
      'email',
      'address',
      'platform_or_store',
      'typical_lead_time_days',
      'notes',
    ],
    required: ['supplier_name'],
  },
  {
    code: '02-items',
    title: 'Items',
    order: 3,
    creates: 'items',
    dependsOn: ['01-units', '03-suppliers'],
    columns: [
      'name',
      'sku',
      'item_type',
      'category',
      'brand',
      'variant_attributes',
      'colour',
      'base_unit',
      'purchase_unit',
      'purchase_to_base_factor',
      'reorder_point_base_unit',
      'preferred_supplier',
      'supplier_lead_time_days',
      'notes',
    ],
    required: ['name', 'item_type', 'base_unit'],
  },
  {
    code: '04-purchases',
    title: 'Purchases',
    order: 4,
    creates: 'purchase headers',
    dependsOn: ['03-suppliers'],
    columns: [
      'purchase_ref',
      'supplier_name',
      'purchase_date',
      'supplier_shipping_amount',
      'discount_amount',
      'duties_amount',
      'other_landed_cost_amount',
      'landed_cost_allocation_base',
      'vat_treatment',
      'vat_amount',
      'payment_status',
      'receipt_file_name',
      'notes',
    ],
    required: ['purchase_ref', 'purchase_date'],
  },
  {
    code: '05-purchase-lines',
    title: 'Purchase lines',
    order: 5,
    creates: 'purchase lines, then receipt movements on apply',
    dependsOn: ['04-purchases', '02-items'],
    columns: [
      'purchase_ref',
      'item_name',
      'quantity_ordered',
      'quantity_received',
      'purchase_unit',
      'unit_price',
      'line_discount_amount',
      'notes',
    ],
    required: ['purchase_ref', 'item_name', 'quantity_ordered', 'unit_price'],
  },
  {
    code: '06-opening-stock',
    title: 'Opening stock',
    order: 6,
    creates: 'opening balance movements',
    dependsOn: ['02-items'],
    columns: ['item_name', 'quantity_on_hand', 'unit', 'unit_cost', 'as_of_date', 'notes'],
    required: ['item_name', 'quantity_on_hand'],
  },
  {
    code: '07-equipment',
    title: 'Equipment',
    order: 7,
    creates: 'equipment and a first rate version',
    dependsOn: [],
    columns: [
      'equipment_name',
      'category',
      'purchase_price',
      'purchase_date',
      'expected_useful_life_years',
      'cost_recovery_period_months',
      'expected_productive_hours_in_recovery_period',
      'rated_power_watts',
      'measured_average_power_watts',
      'annual_maintenance_allowance',
      'annual_repair_allowance',
      'status',
      'notes',
    ],
    required: ['equipment_name', 'purchase_price'],
  },
  {
    code: '08-utility-rates',
    title: 'Utility rates',
    order: 8,
    creates: 'utility rate versions',
    dependsOn: ['01-units'],
    columns: [
      'utility_type',
      'rate_per_unit',
      'unit',
      'effective_from',
      'source_or_bill_reference',
      'notes',
    ],
    required: ['utility_type', 'rate_per_unit', 'unit', 'effective_from'],
  },
  {
    code: '09-labor-activities',
    title: 'Labour activities',
    order: 9,
    creates: 'activities and a first rate version',
    dependsOn: ['01-units'],
    columns: [
      'activity_name',
      'hourly_rate',
      'default_duration',
      'duration_unit',
      'attended',
      'status',
      'notes',
    ],
    required: ['activity_name', 'hourly_rate'],
  },
  {
    code: '10-overhead',
    title: 'Overhead',
    order: 10,
    creates: 'an overhead version and its category lines',
    dependsOn: [],
    columns: ['overhead_category', 'monthly_amount', 'effective_from', 'notes'],
    required: ['overhead_category', 'monthly_amount', 'effective_from'],
  },
  {
    code: '11-products',
    title: 'Products',
    order: 11,
    creates: 'finished products and their details',
    dependsOn: ['02-items'],
    columns: [
      'product_name',
      'sku',
      'category',
      'variant_name',
      'expected_output_quantity_per_run',
      'expected_failure_rate_percent',
      'target_margin_percent',
      'minimum_margin_percent',
      'packaging_item',
      'status',
      'notes',
    ],
    required: ['product_name'],
  },
  {
    code: '12-bom-lines',
    title: 'Recipe lines',
    order: 12,
    creates: 'recipe revision 1 and its lines',
    dependsOn: ['11-products', '02-items', '07-equipment', '09-labor-activities'],
    columns: [
      'product_name',
      'variant_name',
      'line_type',
      'item_or_activity_or_equipment',
      'quantity_per_unit',
      'unit',
      'expected_waste_percent',
      'notes',
    ],
    required: ['product_name', 'line_type', 'item_or_activity_or_equipment'],
  },
  {
    code: '13-sales-channels',
    title: 'Sales channels',
    order: 13,
    creates: 'channels and a first fee version',
    dependsOn: [],
    columns: [
      'channel_name',
      'commission_fee_percent',
      'payment_fee_percent',
      'fixed_fee_per_order',
      'typical_shipping_charged_to_customer',
      'typical_actual_shipping_cost',
      'notes',
    ],
    required: ['channel_name'],
  },
];

export function templateByCode(code: string): Template | undefined {
  return TEMPLATES.find((template) => template.code === code);
}

/**
 * A CSV parser that handles the three things a spreadsheet actually produces:
 * quoted fields, escaped quotes inside them, and newlines inside a quoted
 * field. Splitting on commas is wrong the first time somebody types a reason
 * with a comma in it.
 */
export function parseCsv(input: string): string[][] {
  // Excel writes a byte order mark so it opens peso text correctly; it is not
  // part of the first column's name.
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r') {
      index += 1;
      continue;
    }
    if (char === '\n') {
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows.filter((line) => line.some((value) => value.trim() !== ''));
}

export interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
}

export function readTemplateFile(input: string): ParsedFile {
  const parsed = parseCsv(input);
  if (parsed.length === 0) return { columns: [], rows: [] };
  const columns = parsed[0]!.map((name) => name.trim());
  return {
    columns,
    rows: parsed
      .slice(1)
      .map((values) =>
        Object.fromEntries(columns.map((name, index) => [name, (values[index] ?? '').trim()])),
      ),
  };
}

/**
 * The example row every template ships with, so an owner can see the shape.
 * Importing it would create a "PLA Basic Filament EXAMPLE ROW", so it is
 * skipped rather than imported or rejected.
 */
export function isExampleRow(row: Record<string, string>): boolean {
  return Object.values(row).some((value) => value.toUpperCase().includes('EXAMPLE ROW'));
}

/** The upload, returned with two columns appended, so the fix happens in place. */
export function errorCsv(
  columns: string[],
  rows: Record<string, string>[],
  errors: RowError[],
): string {
  const escape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const byRow = new Map<number, RowError[]>();
  for (const error of errors) {
    byRow.set(error.row, [...(byRow.get(error.row) ?? []), error]);
  }
  const header = [...columns, 'error_field', 'error_message'].map(escape).join(',');
  const lines = [...byRow.keys()]
    .sort((a, b) => a - b)
    .map((rowNumber) => {
      const found = byRow.get(rowNumber)!;
      const original = rows[rowNumber - 2] ?? {};
      return [
        ...columns.map((column) => escape(original[column] ?? '')),
        escape(found.map((error) => error.field).join('; ')),
        escape(found.map((error) => error.message).join('; ')),
      ].join(',');
    });
  return ['﻿' + header, ...lines].join('\r\n');
}

/** Which templates must come first, named in the order to run them. */
export function missingDependencies(template: Template, importedCodes: string[]): string[] {
  return template.dependsOn.filter((code) => !importedCodes.includes(code));
}

export function orderMessage(template: Template, missing: string[]): string {
  const ordered = missing
    .map((code) => templateByCode(code))
    .filter((found): found is Template => found !== undefined)
    .sort((a, b) => a.order - b.order)
    .map((found) => found.code);
  return `Import ${ordered.join(', then ')} before ${template.code}`;
}
