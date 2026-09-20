import { createClient } from '@/lib/supabase/server';
import {
  calculateProductCost,
  energyRatePerKwh,
  type CostInput,
  type ProductCost,
} from '@/lib/product-cost';
import { toDecimal } from '@/lib/decimal';
import { recipeQuantityInBase, type RecipeUnit } from '@/lib/recipe-quantity';

export interface ProductRecord {
  id: string;
  org_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  archived_at: string | null;
  base_unit_id: string;
  expected_failure_rate: string | null;
  expected_output_qty_per_run: string | null;
  bom: {
    id: string;
    revision_no: number;
    status: string;
    locked_at: string | null;
    notes: string | null;
  } | null;
  lines: RecipeLine[];
}

export interface RecipeLine {
  id: string;
  line_type:
    | 'material'
    | 'component'
    | 'packaging'
    | 'subassembly'
    | 'machine_time'
    | 'labour'
    | 'other_cost';
  ref_item_id: string | null;
  ref_equipment_id: string | null;
  ref_activity_id: string | null;
  qty_per_unit: string | null;
  unit_id: string | null;
  waste_rate: string;
  amount_cents: string | null;
  notes: string | null;
}

export interface RecipeOptions {
  items: {
    id: string;
    name: string;
    item_type: string;
    base_unit_id: string;
    avg_unit_cost: string | null;
  }[];
  units: { id: string; code: string; name: string }[];
  equipment: { id: string; name: string }[];
  activities: { id: string; name: string; attended: boolean }[];
}

export async function listProducts(
  orgId: string,
  q = '',
  page = 1,
): Promise<{
  rows: {
    id: string;
    name: string;
    sku: string | null;
    variant_attributes: { label?: string };
    archived_at: string | null;
  }[];
  count: number;
  error: string | null;
}> {
  const db = await createClient();
  const pageSize = 20;
  let query = db
    .from('items')
    .select('id,name,sku,variant_attributes,archived_at', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('item_type', 'finished_product')
    .is('archived_at', null);
  if (q.trim())
    query = query.or(
      `name.ilike.*${q.trim().replace(/[,()*\\]/g, ' ')}*,sku.ilike.*${q.trim().replace(/[,()*\\]/g, ' ')}*`,
    );
  const { data, count, error } = await query
    .order('name')
    .order('id')
    .range((page - 1) * pageSize, page * pageSize - 1);
  return {
    rows: (data ?? []) as {
      id: string;
      name: string;
      sku: string | null;
      variant_attributes: { label?: string };
      archived_at: string | null;
    }[],
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

export async function getProduct(id: string, orgId?: string): Promise<ProductRecord | null> {
  const db = await createClient();
  let itemQuery = db
    .from('items')
    .select('id,org_id,name,sku,description,archived_at,base_unit_id')
    .eq('id', id)
    .eq('item_type', 'finished_product');
  if (orgId) itemQuery = itemQuery.eq('org_id', orgId);
  const [itemResult, detailsResult, bomResult] = await Promise.all([
    itemQuery.maybeSingle(),
    db
      .from('product_details')
      .select('expected_failure_rate::text,expected_output_qty_per_run::text')
      .eq('item_id', id)
      .maybeSingle(),
    db
      .from('boms')
      .select('id,revision_no,status,locked_at,notes')
      .eq('item_id', id)
      .eq('status', 'active')
      .maybeSingle(),
  ]);
  if (itemResult.error) throw new Error(itemResult.error.message);
  if (!itemResult.data) return null;
  if (detailsResult.error) throw new Error(detailsResult.error.message);
  if (bomResult.error) throw new Error(bomResult.error.message);
  const bom = bomResult.data as ProductRecord['bom'];
  let lines: RecipeLine[] = [];
  if (bom) {
    const result = await db
      .from('bom_lines')
      .select(
        'id,line_type,ref_item_id,ref_equipment_id,ref_activity_id,qty_per_unit::text,unit_id,waste_rate::text,amount_cents::text,notes',
      )
      .eq('bom_id', bom.id)
      .order('sort_order')
      .order('id')
      .range(0, 499);
    if (result.error) throw new Error(result.error.message);
    lines = (result.data ?? []) as RecipeLine[];
  }
  return {
    ...(itemResult.data as Omit<
      ProductRecord,
      'expected_failure_rate' | 'expected_output_qty_per_run' | 'bom' | 'lines'
    >),
    expected_failure_rate: detailsResult.data?.expected_failure_rate ?? null,
    expected_output_qty_per_run: detailsResult.data?.expected_output_qty_per_run ?? null,
    bom,
    lines,
  };
}

export async function getRecipeOptions(orgId: string): Promise<RecipeOptions> {
  const db = await createClient();
  const [items, units, equipment, activities] = await Promise.all([
    db
      .from('items')
      .select('id,name,item_type,base_unit_id,avg_unit_cost::text')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .order('name')
      .order('id')
      .range(0, 499),
    db
      .from('units')
      .select('id,code,name')
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .is('archived_at', null)
      .order('name')
      .order('id')
      .range(0, 499),
    db
      .from('equipment')
      .select('id,name')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('name')
      .order('id')
      .range(0, 499),
    db
      .from('labor_activities')
      .select('id,name,attended')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('name')
      .order('id')
      .range(0, 499),
  ]);
  for (const result of [items, units, equipment, activities])
    if (result.error) throw new Error(result.error.message);
  return {
    items: (items.data ?? []) as RecipeOptions['items'],
    units: (units.data ?? []) as RecipeOptions['units'],
    equipment: (equipment.data ?? []) as RecipeOptions['equipment'],
    activities: (activities.data ?? []) as RecipeOptions['activities'],
  };
}

function latest<T extends { effective_from: string; id: string }>(
  versions: T[],
  date: string,
): T | null {
  return (
    versions
      .filter((v) => v.effective_from <= date)
      .sort(
        (a, b) => b.effective_from.localeCompare(a.effective_from) || b.id.localeCompare(a.id),
      )[0] ?? null
  );
}

function mergeQueryRows<T>(results: { data: T[] | null; error: { message: string } | null }[]) {
  return {
    data: results.flatMap((result) => result.data ?? []),
    error: results.find((result) => result.error)?.error ?? null,
  };
}

/** The estimate is recomputed for a date. No estimate is stored in stock. */
export async function getProductCost(
  product: ProductRecord,
  date: string,
): Promise<ProductCost | null> {
  if (!product.bom) return null;
  const db = await createClient();
  const materialIds = [
    ...new Set(product.lines.map((l) => l.ref_item_id).filter((v): v is string => v !== null)),
  ];
  const equipmentIds = [
    ...new Set(product.lines.map((l) => l.ref_equipment_id).filter((v): v is string => v !== null)),
  ];
  const activityIds = [
    ...new Set(product.lines.map((l) => l.ref_activity_id).filter((v): v is string => v !== null)),
  ];
  const [
    itemsResult,
    equipmentResult,
    activitiesResult,
    equipmentRatesResult,
    labourRatesResult,
    utilityResult,
    overheadResult,
    unitsResult,
  ] = await Promise.all([
    materialIds.length
      ? db
          .from('items')
          .select(
            'id,name,avg_unit_cost::text,base_unit_id,purchase_unit_id,purchase_to_base_factor::text',
          )
          .in('id', materialIds)
          .order('id')
          .range(0, 499)
      : Promise.resolve({ data: [], error: null }),
    equipmentIds.length
      ? db
          .from('equipment')
          .select('id,name,measured_avg_power_watts::text')
          .in('id', equipmentIds)
          .order('id')
          .range(0, 499)
      : Promise.resolve({ data: [], error: null }),
    activityIds.length
      ? db
          .from('labor_activities')
          .select('id,name,attended')
          .in('id', activityIds)
          .order('id')
          .range(0, 499)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(
      equipmentIds.map((equipmentId) =>
        db
          .from('equipment_rate_versions')
          .select('id,equipment_id,effective_from,hourly_recovery_rate::text')
          .eq('equipment_id', equipmentId)
          .lte('effective_from', date)
          .order('effective_from', { ascending: false })
          .order('id', { ascending: false })
          .range(0, 0),
      ),
    ).then(mergeQueryRows),
    Promise.all(
      activityIds.map((activityId) =>
        db
          .from('labor_rate_versions')
          .select('id,activity_id,effective_from,hourly_rate::text')
          .eq('activity_id', activityId)
          .lte('effective_from', date)
          .order('effective_from', { ascending: false })
          .order('id', { ascending: false })
          .range(0, 0),
      ),
    ).then(mergeQueryRows),
    db
      .from('utility_rates')
      .select('id,effective_from,rate_per_unit::text,unit_id')
      .eq('org_id', product.org_id)
      .eq('utility_type', 'electricity')
      .lte('effective_from', date)
      .order('effective_from', { ascending: false })
      .order('id', { ascending: false })
      .range(0, 0),
    db
      .from('overhead_versions')
      .select('id,effective_from,method,rate::text,percent::text')
      .eq('org_id', product.org_id)
      .lte('effective_from', date)
      .order('effective_from', { ascending: false })
      .order('id', { ascending: false })
      .range(0, 0),
    db
      .from('units')
      .select('id,code,dimension_code,factor_to_dimension_base::text')
      .or(`org_id.is.null,org_id.eq.${product.org_id}`)
      .order('id')
      .range(0, 499),
  ]);
  for (const result of [
    itemsResult,
    equipmentResult,
    activitiesResult,
    equipmentRatesResult,
    labourRatesResult,
    utilityResult,
    overheadResult,
    unitsResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const items = (itemsResult.data ?? []) as {
    id: string;
    name: string;
    avg_unit_cost: string | null;
    base_unit_id: string;
    purchase_unit_id: string | null;
    purchase_to_base_factor: string | null;
  }[];
  const equipment = (equipmentResult.data ?? []) as {
    id: string;
    name: string;
    measured_avg_power_watts: string | null;
  }[];
  const activities = (activitiesResult.data ?? []) as {
    id: string;
    name: string;
    attended: boolean;
  }[];
  const equipmentRates = (equipmentRatesResult.data ?? []) as {
    id: string;
    equipment_id: string;
    effective_from: string;
    hourly_recovery_rate: string;
  }[];
  const labourRates = (labourRatesResult.data ?? []) as {
    id: string;
    activity_id: string;
    effective_from: string;
    hourly_rate: string;
  }[];
  const utility = (utilityResult.data ?? [])[0] as
    { effective_from: string; rate_per_unit: string; unit_id: string } | undefined;
  const overhead = (overheadResult.data ?? [])[0] as
    | { effective_from: string; method: string; rate: string | null; percent: string | null }
    | undefined;
  const units = (unitsResult.data ?? []) as RecipeUnit[];
  const utilityUnit = units.find((unit) => unit.id === utility?.unit_id);
  const utilityPerKwh =
    utility && utilityUnit
      ? energyRatePerKwh(utility.rate_per_unit, utilityUnit.factor_to_dimension_base).toString()
      : null;
  const inputs: CostInput[] = [];
  for (const line of product.lines) {
    if (line.ref_item_id) {
      const item = items.find((i) => i.id === line.ref_item_id);
      if (!item || !line.unit_id) throw new Error('A recipe item or unit could not be loaded.');
      const quantity = toDecimal(line.qty_per_unit ?? '0').times(
        toDecimal('1').plus(line.waste_rate),
      );
      const converted = recipeQuantityInBase(item, quantity, line.unit_id, units);
      inputs.push({
        kind: 'item',
        id: line.id,
        name: item?.name ?? 'Missing item',
        quantity: converted,
        unit: units.find((u) => u.id === item?.base_unit_id)?.code ?? '',
        unitCost: item?.avg_unit_cost ?? null,
        source: 'Current item average cost',
        netQuantity: line.qty_per_unit ?? '0',
        inputUnit: units.find((u) => u.id === line.unit_id)?.code ?? '',
        wasteRate: line.waste_rate,
      });
    } else if (line.ref_equipment_id) {
      const machine = equipment.find((e) => e.id === line.ref_equipment_id);
      const rate = latest(
        equipmentRates.filter((r) => r.equipment_id === line.ref_equipment_id),
        date,
      );
      inputs.push({
        kind: 'machine',
        id: line.id,
        name: machine?.name ?? 'Missing equipment',
        hours: line.qty_per_unit ?? '0',
        rate: rate?.hourly_recovery_rate ?? null,
        rateDate: rate?.effective_from ?? null,
        watts: machine?.measured_avg_power_watts ?? null,
        utilityRate: utilityPerKwh,
        utilityDate: utility?.effective_from ?? null,
      });
    } else if (line.ref_activity_id) {
      const activity = activities.find((a) => a.id === line.ref_activity_id);
      const rate = latest(
        labourRates.filter((r) => r.activity_id === line.ref_activity_id),
        date,
      );
      inputs.push({
        kind: 'labour',
        id: line.id,
        name: activity?.name ?? 'Missing activity',
        hours: line.qty_per_unit ?? '0',
        attended: activity?.attended ?? false,
        rate: rate?.hourly_rate ?? null,
        rateDate: rate?.effective_from ?? null,
      });
    } else {
      inputs.push({
        kind: 'other',
        id: line.id,
        name: line.notes || 'Other cost',
        amountCents: line.amount_cents ?? '0',
      });
    }
  }
  return calculateProductCost(
    inputs,
    product.expected_failure_rate,
    overhead
      ? {
          method: overhead.method,
          rate: overhead.rate,
          percent: overhead.percent,
          effectiveFrom: overhead.effective_from,
        }
      : null,
  );
}
