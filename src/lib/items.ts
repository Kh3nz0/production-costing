import { createClient } from '@/lib/supabase/server';
import { isItemType, type ItemDetail, type ItemRow, type UnitOption } from '@/lib/item-types';

export interface ItemListQuery {
  type?: string;
  q?: string;
  showArchived?: boolean;
}

/**
 * The Items list.
 *
 * Every list in this system pages with `.range()`, because PostgREST caps a
 * response at 1000 rows and `.limit()` cannot raise it — and every paged query
 * ends its order chain with a unique column, because paging over a non-unique
 * sort returns rows in a different order per page, duplicating some and
 * skipping others (D-080). `name` is not unique, so `id` follows it.
 */
export async function listItems(query: ItemListQuery = {}): Promise<{
  rows: ItemRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const PAGE = 500;

  let builder = supabase
    .from('items')
    .select(
      'id, name, sku, item_type, qty_on_hand, avg_unit_cost, reorder_point, archived_at, base_unit:units!items_base_unit_id_fkey(code, name)',
    );

  if (query.showArchived !== true) {
    builder = builder.is('archived_at', null);
  }
  if (query.type !== undefined && isItemType(query.type)) {
    builder = builder.eq('item_type', query.type);
  }
  if (query.q !== undefined && query.q.trim() !== '') {
    // Search name and SKU together. The value is escaped for PostgREST's `or`
    // grammar, where a comma separates conditions and a parenthesis closes one.
    const term = query.q.trim().replace(/[,()*\\]/g, ' ');
    builder = builder.or(`name.ilike.*${term}*,sku.ilike.*${term}*`);
  }

  const { data, error } = await builder
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, PAGE - 1);

  if (error !== null) {
    return { rows: [], error: error.message };
  }
  return { rows: (data ?? []) as unknown as ItemRow[], error: null };
}

/** Seeded units plus any this org added, for the two unit pickers. */
export async function listUnits(): Promise<UnitOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('units')
    .select('id, code, name, dimension_code')
    .is('archived_at', null)
    .order('dimension_code', { ascending: true })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, 499);
  return (data ?? []) as UnitOption[];
}

export async function getItem(id: string): Promise<ItemDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('items')
    .select(
      'id, name, sku, item_type, qty_on_hand, avg_unit_cost, reorder_point, archived_at, brand, colour, description, notes, supplier_lead_time_days, purchase_to_base_factor, is_costed, created_at, base_unit:units!items_base_unit_id_fkey(code, name), purchase_unit:units!items_purchase_unit_id_fkey(code, name)',
    )
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as ItemDetail) ?? null;
}
