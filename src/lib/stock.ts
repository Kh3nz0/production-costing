import { createClient } from '@/lib/supabase/server';
import type { MovementType } from '@/lib/stock-types';
import type { ItemType } from '@/lib/item-types';

export interface ValuationRow {
  item_id: string;
  item_name: string;
  item_type: ItemType;
  unit_code: string;
  quantity: string;
  unit_cost: string | null;
  value_cents: string | null;
}

/**
 * What stock was worth on a date. A lookup of each item's last movement at or
 * before it, so a movement recorded afterwards cannot change the answer.
 */
export async function valuationAsOf(
  orgId: string,
  asOf: string,
): Promise<{ rows: ValuationRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('inventory_valuation', {
      p_org_id: orgId,
      p_as_of: asOf,
    })
    .select(
      'item_id,item_name,item_type,unit_code,quantity::text,unit_cost::text,value_cents::text',
    );
  if (error !== null) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ValuationRow[], error: null };
}

export interface MovementRow {
  id: string;
  occurred_at: string;
  movement_type: MovementType;
  quantity_change: string;
  resulting_qty: string;
  unit_cost_at_movement: string | null;
  cost_effect_cents: string | null;
  reason: string | null;
  source_table: string | null;
  source_id: string | null;
  item: { name: string; base_unit: { code: string } | null } | null;
}

export interface MovementQuery {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
}

export async function listMovements(
  query: MovementQuery = {},
): Promise<{ rows: MovementRow[]; error: string | null }> {
  const supabase = await createClient();
  let builder = supabase
    .from('inventory_movements')
    .select(
      'id, occurred_at, movement_type, quantity_change::text, resulting_qty::text, unit_cost_at_movement::text, cost_effect_cents::text, reason, source_table, source_id, item:items(name, base_unit:units!items_base_unit_id_fkey(code))',
    );

  if (query.itemId !== undefined && query.itemId !== '') {
    builder = builder.eq('item_id', query.itemId);
  }
  if (query.type !== undefined && query.type !== '') {
    builder = builder.eq('movement_type', query.type);
  }
  if (query.from !== undefined && query.from !== '') {
    builder = builder.gte('occurred_at', query.from);
  }
  if (query.to !== undefined && query.to !== '') {
    builder = builder.lte('occurred_at', `${query.to}T23:59:59.999Z`);
  }

  // Newest first, with seq breaking the tie, because occurred_at is business
  // time and ties freely (D-113).
  const { data, error } = await builder
    .order('occurred_at', { ascending: false })
    .order('seq', { ascending: false })
    .range(0, 499);

  if (error !== null) return { rows: [], error: error.message };
  return { rows: (data ?? []) as unknown as MovementRow[], error: null };
}
