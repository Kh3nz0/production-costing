import 'server-only';
import { createClient } from './supabase/server';

export interface RunListRow {
  id: string;
  run_date: string;
  status: string;
  units_accepted: number | null;
  units_failed: number | null;
  actual_cost_per_accepted_unit: string | null;
  estimated_unit_cost: string | null;
  item: { name: string } | null;
}

export interface RunLineRow {
  id: string;
  line_type: string;
  ref_item_id: string | null;
  ref_equipment_id: string | null;
  ref_activity_id: string | null;
  unit_id: string | null;
  expected_qty: string | null;
  actual_qty: string | null;
  unit_cost_at_run: string | null;
  cost_cents: string | null;
  sort_order: number;
}

export interface RunRecord {
  id: string;
  org_id: string;
  item_id: string;
  bom_id: string | null;
  run_date: string;
  status: string;
  planned_qty: string;
  units_started: number | null;
  units_accepted: number | null;
  units_failed: number | null;
  estimated_total_cost_cents: string | null;
  estimated_unit_cost: string | null;
  actual_total_cost_cents: string | null;
  abnormal_loss_cents: string | null;
  capitalised_cost_cents: string | null;
  actual_cost_per_accepted_unit: string | null;
  rate_snapshot: Record<string, unknown>;
  notes: string | null;
  item: { name: string; base_unit_id: string } | null;
  lines: RunLineRow[];
}

const LIST_COLUMNS =
  'id,run_date,status,units_accepted,units_failed,actual_cost_per_accepted_unit::text,estimated_unit_cost::text,item:items!production_runs_org_id_item_id_fkey(name)';

export async function listRuns(orgId: string, status?: string): Promise<RunListRow[]> {
  const db = await createClient();
  let query = db
    .from('production_runs')
    .select(LIST_COLUMNS)
    .eq('org_id', orgId)
    .order('run_date', { ascending: false })
    .order('id', { ascending: false })
    .range(0, 499);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RunListRow[];
}

export async function getRun(id: string, orgId: string): Promise<RunRecord | null> {
  const db = await createClient();
  const [runResult, lineResult] = await Promise.all([
    db
      .from('production_runs')
      .select(
        'id,org_id,item_id,bom_id,run_date,status,planned_qty::text,units_started,units_accepted,units_failed,estimated_total_cost_cents::text,estimated_unit_cost::text,actual_total_cost_cents::text,abnormal_loss_cents::text,capitalised_cost_cents::text,actual_cost_per_accepted_unit::text,rate_snapshot,notes,item:items!production_runs_org_id_item_id_fkey(name,base_unit_id)',
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle(),
    db
      .from('production_run_lines')
      .select(
        'id,line_type,ref_item_id,ref_equipment_id,ref_activity_id,unit_id,expected_qty::text,actual_qty::text,unit_cost_at_run::text,cost_cents::text,sort_order',
      )
      .eq('run_id', id)
      .order('sort_order')
      .order('id')
      .range(0, 499),
  ]);
  if (runResult.error) throw new Error(runResult.error.message);
  if (!runResult.data) return null;
  if (lineResult.error) throw new Error(lineResult.error.message);
  return {
    ...(runResult.data as unknown as Omit<RunRecord, 'lines'>),
    lines: (lineResult.data ?? []) as unknown as RunLineRow[],
  };
}

/** Names for whatever a line points at, so the form can label its rows. */
export async function getRunLineLabels(
  lines: RunLineRow[],
): Promise<Map<string, { name: string; unit: string | null }>> {
  const db = await createClient();
  const itemIds = lines.flatMap((l) => (l.ref_item_id ? [l.ref_item_id] : []));
  const equipmentIds = lines.flatMap((l) => (l.ref_equipment_id ? [l.ref_equipment_id] : []));
  const activityIds = lines.flatMap((l) => (l.ref_activity_id ? [l.ref_activity_id] : []));
  const [items, equipment, activities] = await Promise.all([
    itemIds.length
      ? db
          .from('items')
          .select('id,name,base_unit:units!items_base_unit_id_fkey(code)')
          .in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    equipmentIds.length
      ? db.from('equipment').select('id,name').in('id', equipmentIds)
      : Promise.resolve({ data: [], error: null }),
    activityIds.length
      ? db.from('labor_activities').select('id,name').in('id', activityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const labels = new Map<string, { name: string; unit: string | null }>();
  for (const row of (items.data ?? []) as unknown as {
    id: string;
    name: string;
    base_unit: { code: string } | null;
  }[]) {
    labels.set(row.id, { name: row.name, unit: row.base_unit?.code ?? null });
  }
  for (const row of (equipment.data ?? []) as { id: string; name: string }[]) {
    labels.set(row.id, { name: row.name, unit: 'h' });
  }
  for (const row of (activities.data ?? []) as { id: string; name: string }[]) {
    labels.set(row.id, { name: row.name, unit: 'h' });
  }
  return labels;
}

export async function listMakeableProducts(
  orgId: string,
): Promise<{ id: string; name: string; failure_rate: string | null }[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('product_details')
    .select(
      'item_id,expected_failure_rate::text,active_bom_id,item:items!product_details_org_id_item_id_fkey(name,archived_at)',
    )
    .eq('org_id', orgId)
    .not('active_bom_id', 'is', null)
    .order('item_id')
    .range(0, 499);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as unknown as {
      item_id: string;
      expected_failure_rate: string | null;
      item: { name: string; archived_at: string | null } | null;
    }[]
  )
    .filter((row) => row.item && row.item.archived_at === null)
    .map((row) => ({
      id: row.item_id,
      name: row.item!.name,
      failure_rate: row.expected_failure_rate,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
