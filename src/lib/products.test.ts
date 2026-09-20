import { expect, it, vi } from 'vitest';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  getProduct,
  getProductCost,
  getRecipeOptions,
  listProducts,
  type ProductRecord,
} from './products';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

type FixtureRow = Record<string, string | number | boolean | null>;

function fixtureClient(tables: Record<string, FixtureRow[]>) {
  return createSupabaseClient('https://fixture.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: class {
        constructor() {
          throw new Error('Unexpected realtime connection');
        }
      } as unknown as typeof WebSocket,
    },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split('/').at(-1)!;
        const source = tables[table];
        if (!source) throw new Error(`Unexpected request: ${table}`);
        let rows = source.filter((row) => {
          for (const [column, filter] of url.searchParams) {
            if (filter.startsWith('eq.') && row[column] !== filter.slice(3)) return false;
            if (filter.startsWith('lte.') && (row[column] as string) > filter.slice(4))
              return false;
            if (filter === 'is.null' && row[column] != null) return false;
            if (
              filter.startsWith('in.(') &&
              !filter
                .slice(4, -1)
                .split(',')
                .includes(row[column] as string)
            )
              return false;
            if (
              column === 'or' &&
              !filter
                .slice(1, -1)
                .split(',')
                .some((clause) => {
                  const [key, operation, value] = clause.split('.');
                  return operation === 'is' ? row[key!] == null : row[key!] === value;
                })
            )
              return false;
          }
          return true;
        });
        if (url.searchParams.get('order')?.startsWith('effective_from.desc'))
          rows = rows.sort(
            (a, b) =>
              (b.effective_from as string).localeCompare(a.effective_from as string) ||
              (b.id as string).localeCompare(a.id as string),
          );
        const count = rows.length;
        if (url.searchParams.get('limit') === '1') rows = rows.slice(0, 1);
        if (url.searchParams.get('limit') === '500') rows = rows.slice(0, 500);
        const selected = (url.searchParams.get('select') ?? '')
          .split(',')
          .map((column) => column.split('::')[0]!);
        return new Response(
          JSON.stringify(
            rows.map((row) => Object.fromEntries(selected.map((key) => [key, row[key] ?? null]))),
          ),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'content-range': `0-${Math.max(0, rows.length - 1)}/${count}`,
            },
          },
        );
      },
    },
  });
}

it('keeps decimals and bigint centavos exact across the Supabase JSON parser', async () => {
  const numeric = (source: string) => ({ numeric: source });
  type WireValue = string | number | boolean | null | { numeric: string };
  const tables: Record<string, Record<string, WireValue>[]> = {
    items: [
      {
        id: 'material',
        org_id: 'product-org',
        name: 'Exact material',
        sku: null,
        description: null,
        archived_at: null,
        base_unit_id: 'pc',
        purchase_unit_id: null,
        purchase_to_base_factor: null,
        avg_unit_cost: numeric('12345678901.12345678'),
      },
    ],
    product_details: [
      {
        expected_failure_rate: numeric('0.000000'),
        expected_output_qty_per_run: numeric('1.000000'),
      },
    ],
    boms: [{ id: 'recipe', revision_no: 1, status: 'active', locked_at: null, notes: null }],
    bom_lines: [
      {
        id: 'material-line',
        line_type: 'material',
        ref_item_id: 'material',
        ref_equipment_id: null,
        ref_activity_id: null,
        qty_per_unit: numeric('1.000000'),
        unit_id: 'pc',
        waste_rate: numeric('0.000000'),
        amount_cents: null,
        notes: null,
      },
      {
        id: 'other-line',
        line_type: 'other_cost',
        ref_item_id: null,
        ref_equipment_id: null,
        ref_activity_id: null,
        qty_per_unit: null,
        unit_id: null,
        waste_rate: numeric('0.000000'),
        amount_cents: numeric('9007199254740993'),
        notes: 'Exact centavos',
      },
    ],
    utility_rates: [],
    overhead_versions: [
      { id: 'overhead', effective_from: '2026-01-01', method: 'none', rate: null, percent: null },
    ],
    units: [
      {
        id: 'pc',
        code: 'pc',
        dimension_code: 'count',
        factor_to_dimension_base: numeric('1.00000000'),
      },
    ],
  };
  // Model the wire contract, not the calculator: numeric JSON tokens stay
  // unquoted unless the request explicitly projects the column as text.
  // The real installed SDK parses these bytes with JSON.parse.
  const requests: string[] = [];
  const api = createSupabaseClient('https://fixture.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node 20 has no native WebSocket. This test uses only REST; fail if the
    // loader unexpectedly tries to open a realtime connection.
    realtime: {
      transport: class {
        constructor() {
          throw new Error('Unexpected realtime connection');
        }
      } as unknown as typeof WebSocket,
    },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split('/').at(-1)!;
        requests.push(table);
        const selected = (url.searchParams.get('select') ?? '').split(',');
        const source = tables[table];
        if (!source) throw new Error(`Unexpected request: ${table}`);
        const rows = source.map(
          (row) =>
            `{${selected
              .map((column) => {
                const [key, cast] = column.split('::');
                const value = row[key!];
                const encoded =
                  value !== null && typeof value === 'object'
                    ? cast === 'text'
                      ? JSON.stringify(value.numeric)
                      : value.numeric
                    : JSON.stringify(value ?? null);
                return `${JSON.stringify(key)}:${encoded}`;
              })
              .join(',')}}`,
        );
        return new Response(`[${rows.join(',')}]`, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  vi.mocked(createClient).mockResolvedValue(api);
  const product = await getProduct('product');
  expect(product).not.toBeNull();
  expect(product!.expected_failure_rate).toBe('0.000000');
  expect(product!.expected_output_qty_per_run).toBe('1.000000');
  expect(product!.lines[0]!.qty_per_unit).toBe('1.000000');
  expect(product!.lines[1]!.amount_cents).toBe('9007199254740993');
  const cost = await getProductCost(product!, '2026-09-20');
  expect(cost!.rows[0]!.amount!.toString()).toBe('12345678901.12345678');
  expect(cost!.rows[1]!.amount!.toString()).toBe('90071992547409.93');
  expect(cost!.fullExact.toString()).toBe('90084338226311.05345678');
  expect(requests).not.toContain('convert_to_base');
});

it('uses electricity and overhead rates from the product organization on the costing date', async () => {
  const tables: Record<string, FixtureRow[]> = {
    items: [
      {
        id: 'product',
        org_id: 'product-org',
        item_type: 'finished_product',
        name: 'Organization-scoped product',
        base_unit_id: 'pc',
      },
    ],
    product_details: [
      { item_id: 'product', expected_failure_rate: '0', expected_output_qty_per_run: '1' },
    ],
    boms: [{ id: 'recipe', item_id: 'product', revision_no: 1, status: 'active' }],
    bom_lines: [
      {
        id: 'machine-line',
        bom_id: 'recipe',
        line_type: 'machine_time',
        ref_equipment_id: 'machine',
        qty_per_unit: '1',
        waste_rate: '0',
      },
    ],
    equipment: [{ id: 'machine', name: 'Printer', measured_avg_power_watts: '1000' }],
    equipment_rate_versions: [
      {
        id: 'machine-rate',
        equipment_id: 'machine',
        effective_from: '2026-01-01',
        hourly_recovery_rate: '10',
      },
    ],
    utility_rates: [
      {
        id: 'own-electricity',
        org_id: 'product-org',
        utility_type: 'electricity',
        effective_from: '2026-01-01',
        rate_per_unit: '12.5',
        unit_id: 'kwh',
      },
      {
        id: 'other-electricity',
        org_id: 'other-org',
        utility_type: 'electricity',
        effective_from: '2026-06-01',
        rate_per_unit: '900',
        unit_id: 'kwh',
      },
      {
        id: 'future-electricity',
        org_id: 'product-org',
        utility_type: 'electricity',
        effective_from: '2027-01-01',
        rate_per_unit: '999',
        unit_id: 'kwh',
      },
    ],
    overhead_versions: [
      {
        id: 'own-overhead',
        org_id: 'product-org',
        effective_from: '2026-01-01',
        method: 'flat_per_unit',
        rate: '5',
      },
      {
        id: 'other-overhead',
        org_id: 'other-org',
        effective_from: '2026-06-01',
        method: 'flat_per_unit',
        rate: '900',
      },
      {
        id: 'future-overhead',
        org_id: 'product-org',
        effective_from: '2027-01-01',
        method: 'flat_per_unit',
        rate: '999',
      },
    ],
    units: [{ id: 'kwh', code: 'kWh', dimension_code: 'energy', factor_to_dimension_base: '1000' }],
  };
  vi.mocked(createClient).mockResolvedValue(fixtureClient(tables));
  const product = await getProduct('product');
  expect(product!.org_id).toBe('product-org');
  const cost = await getProductCost(product!, '2026-09-20');
  expect(cost!.missing).toEqual([]);
  expect(cost!.rows.find((row) => row.id === 'machine-line-electricity')!.amount!.toString()).toBe(
    '12.5',
  );
  expect(cost!.overheadExact!.toString()).toBe('5');
  expect(cost!.fullExact.toString()).toBe('27.5');
});

it('limits product and recipe choices to the active organization and shared units', async () => {
  vi.mocked(createClient).mockResolvedValue(
    fixtureClient({
      items: [
        {
          id: 'own-product',
          org_id: 'own-org',
          name: 'Own product',
          item_type: 'finished_product',
          archived_at: null,
        },
        {
          id: 'other-product',
          org_id: 'other-org',
          name: 'Other product',
          item_type: 'finished_product',
          archived_at: null,
        },
      ],
      equipment: [
        { id: 'own-machine', org_id: 'own-org', name: 'Own machine', status: 'active' },
        { id: 'other-machine', org_id: 'other-org', name: 'Other machine', status: 'active' },
      ],
      labor_activities: [
        {
          id: 'own-activity',
          org_id: 'own-org',
          name: 'Own activity',
          status: 'active',
          attended: true,
        },
        {
          id: 'other-activity',
          org_id: 'other-org',
          name: 'Other activity',
          status: 'active',
          attended: true,
        },
      ],
      units: [
        { id: 'shared-unit', org_id: null, code: 'pc', name: 'Piece', archived_at: null },
        { id: 'own-unit', org_id: 'own-org', code: 'own', name: 'Own unit', archived_at: null },
        {
          id: 'other-unit',
          org_id: 'other-org',
          code: 'other',
          name: 'Other unit',
          archived_at: null,
        },
      ],
      product_details: [],
      boms: [],
    }),
  );
  const products = await listProducts('own-org');
  expect(products.rows.map((row) => row.id)).toEqual(['own-product']);
  const options = await getRecipeOptions('own-org');
  expect(options.items.map((row) => row.id)).toEqual(['own-product']);
  expect(options.equipment.map((row) => row.id)).toEqual(['own-machine']);
  expect(options.activities.map((row) => row.id)).toEqual(['own-activity']);
  expect(options.units.map((row) => row.id)).toEqual(['shared-unit', 'own-unit']);
  expect(await getProduct('other-product', 'own-org')).toBeNull();
  expect((await getProduct('own-product', 'own-org'))!.org_id).toBe('own-org');
});

it('finds a rate for every referenced machine and activity when another has over 500 versions', async () => {
  const effectiveDates = Array.from({ length: 501 }, (_, day) =>
    new Date(Date.UTC(2024, 0, day + 1)).toISOString().slice(0, 10),
  );
  const product: ProductRecord = {
    id: 'product',
    org_id: 'own-org',
    name: 'Long rate history',
    sku: null,
    description: null,
    archived_at: null,
    base_unit_id: 'pc',
    expected_failure_rate: '0',
    target_margin: null,
    minimum_margin: null,
    expected_output_qty_per_run: '1',
    bom: { id: 'recipe', revision_no: 1, status: 'active', locked_at: null, notes: null },
    lines: ['busy', 'sparse'].flatMap((suffix) => [
      {
        id: `machine-${suffix}`,
        line_type: 'machine_time' as const,
        ref_equipment_id: `machine-${suffix}`,
        ref_activity_id: null,
        ref_item_id: null,
        qty_per_unit: '1',
        unit_id: null,
        waste_rate: '0',
        amount_cents: null,
        notes: null,
      },
      {
        id: `labour-${suffix}`,
        line_type: 'labour' as const,
        ref_activity_id: `activity-${suffix}`,
        ref_equipment_id: null,
        ref_item_id: null,
        qty_per_unit: '1',
        unit_id: null,
        waste_rate: '0',
        amount_cents: null,
        notes: null,
      },
    ]),
  };
  vi.mocked(createClient).mockResolvedValue(
    fixtureClient({
      equipment: ['busy', 'sparse'].map((suffix) => ({
        id: `machine-${suffix}`,
        name: `Machine ${suffix}`,
        measured_avg_power_watts: '0',
      })),
      labor_activities: ['busy', 'sparse'].map((suffix) => ({
        id: `activity-${suffix}`,
        name: `Activity ${suffix}`,
        attended: false,
      })),
      equipment_rate_versions: [
        ...effectiveDates.map((date) => ({
          id: `machine-${date}`,
          equipment_id: 'machine-busy',
          effective_from: date,
          hourly_recovery_rate: '10',
        })),
        {
          id: 'machine-old-rate',
          equipment_id: 'machine-sparse',
          effective_from: '2023-01-01',
          hourly_recovery_rate: '20',
        },
      ],
      labor_rate_versions: [
        ...effectiveDates.map((date) => ({
          id: `labour-${date}`,
          activity_id: 'activity-busy',
          effective_from: date,
          hourly_rate: '3',
        })),
        {
          id: 'labour-old-rate',
          activity_id: 'activity-sparse',
          effective_from: '2023-01-01',
          hourly_rate: '4',
        },
      ],
      utility_rates: [
        {
          id: 'electricity',
          org_id: 'own-org',
          utility_type: 'electricity',
          effective_from: '2023-01-01',
          rate_per_unit: '1',
          unit_id: 'kwh',
        },
      ],
      overhead_versions: [
        {
          id: 'overhead',
          org_id: 'own-org',
          effective_from: '2023-01-01',
          method: 'none',
          rate: null,
          percent: null,
        },
      ],
      units: [
        {
          id: 'kwh',
          org_id: null,
          code: 'kWh',
          dimension_code: 'energy',
          factor_to_dimension_base: '1000',
        },
      ],
    }),
  );
  const cost = await getProductCost(product, '2026-09-20');
  expect(cost!.missing).toEqual([]);
  expect(cost!.rows.find((row) => row.id === 'machine-sparse-machine')!.amount!.toString()).toBe(
    '20',
  );
  expect(cost!.rows.find((row) => row.id === 'labour-sparse')!.amount!.toString()).toBe('4');
  expect(cost!.fullExact.toString()).toBe('37');
});
