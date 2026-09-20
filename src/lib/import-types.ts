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
    columns: ['code', 'name', 'dimension_code', 'factor_to_dimension_base'],
    required: ['code', 'name', 'dimension_code', 'factor_to_dimension_base'],
  },
  {
    code: '03-suppliers',
    title: 'Suppliers',
    order: 2,
    creates: 'suppliers',
    dependsOn: [],
    columns: ['name', 'contact_name', 'phone', 'email', 'address', 'notes'],
    required: ['name'],
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
      'reference_no',
      'purchase_date',
      'supplier',
      'shipping',
      'duties',
      'other_landed_cost',
      'discount',
      'landed_cost_base',
      'notes',
    ],
    required: ['purchase_date'],
  },
  {
    code: '05-purchase-lines',
    title: 'Purchase lines',
    order: 5,
    creates: 'purchase lines, then receipt movements on apply',
    dependsOn: ['04-purchases', '02-items'],
    columns: ['purchase_reference', 'item', 'quantity', 'purchase_unit', 'unit_price', 'discount'],
    required: ['purchase_reference', 'item', 'quantity', 'unit_price'],
  },
  {
    code: '06-opening-stock',
    title: 'Opening stock',
    order: 6,
    creates: 'opening balance movements',
    dependsOn: ['02-items'],
    columns: ['item', 'quantity_base_unit', 'unit_cost', 'as_of_date', 'notes'],
    required: ['item', 'quantity_base_unit'],
  },
  {
    code: '07-equipment',
    title: 'Equipment',
    order: 7,
    creates: 'equipment and a first rate version',
    dependsOn: [],
    columns: [
      'name',
      'category',
      'purchase_price',
      'purchase_date',
      'rated_power_watts',
      'measured_avg_power_watts',
      'cost_recovery_period_months',
      'expected_productive_hours',
      'maintenance_allowance_per_year',
      'repair_allowance_per_year',
      'effective_from',
      'notes',
    ],
    required: ['name', 'purchase_price'],
  },
  {
    code: '08-utility-rates',
    title: 'Utility rates',
    order: 8,
    creates: 'utility rate versions',
    dependsOn: ['01-units'],
    columns: ['utility_type', 'rate_per_unit', 'unit', 'effective_from', 'source_reference'],
    required: ['utility_type', 'rate_per_unit', 'unit', 'effective_from'],
  },
  {
    code: '09-labor-activities',
    title: 'Labour activities',
    order: 9,
    creates: 'activities and a first rate version',
    dependsOn: ['01-units'],
    columns: ['name', 'attended', 'hourly_rate', 'effective_from', 'default_duration', 'notes'],
    required: ['name', 'hourly_rate', 'effective_from'],
  },
  {
    code: '10-overhead',
    title: 'Overhead',
    order: 10,
    creates: 'an overhead version and its lines',
    dependsOn: [],
    columns: ['category', 'monthly_amount', 'expected_working_hours', 'effective_from', 'notes'],
    required: ['category', 'monthly_amount', 'effective_from'],
  },
  {
    code: '11-products',
    title: 'Products',
    order: 11,
    creates: 'finished products and their details',
    dependsOn: ['02-items'],
    columns: [
      'name',
      'sku',
      'variant',
      'base_unit',
      'expected_failure_rate',
      'expected_output_qty_per_run',
      'target_margin',
      'minimum_margin',
      'notes',
    ],
    required: ['name', 'base_unit'],
  },
  {
    code: '12-bom-lines',
    title: 'Recipe lines',
    order: 12,
    creates: 'recipe revision 1 and its lines',
    dependsOn: ['11-products', '02-items', '07-equipment', '09-labor-activities'],
    columns: [
      'product',
      'line_type',
      'item_or_activity',
      'quantity_per_unit',
      'unit',
      'waste_rate',
      'amount',
      'notes',
    ],
    required: ['product', 'line_type'],
  },
  {
    code: '13-sales-channels',
    title: 'Sales channels',
    order: 13,
    creates: 'channels and a first fee version',
    dependsOn: [],
    columns: [
      'name',
      'commission_rate',
      'payment_rate',
      'fixed_fee_per_order',
      'effective_from',
      'notes',
    ],
    required: ['name'],
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
