import { toDecimal } from '@/lib/decimal';

/**
 * Item vocabulary and the pure helpers over it.
 *
 * Deliberately free of any server import. A Client Component needs the type
 * labels and the status rule, and if those lived beside the Supabase server
 * client then importing one would drag `next/headers` into the browser bundle —
 * which is exactly the build failure that split this file.
 */

export const ITEM_TYPES = [
  'raw_material',
  'purchased_component',
  'packaging',
  'consumable',
  'subassembly',
  'finished_product',
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/** The filter chips on the Items list, in the approved order. */
export const TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'raw_material', label: 'Raw materials' },
  { value: 'purchased_component', label: 'Components' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'consumable', label: 'Consumables' },
  { value: 'subassembly', label: 'Subassemblies' },
  { value: 'finished_product', label: 'Finished products' },
] as const;

const TYPE_LABEL: Record<ItemType, string> = {
  raw_material: 'Raw material',
  purchased_component: 'Component',
  packaging: 'Packaging',
  consumable: 'Consumable',
  subassembly: 'Subassembly',
  finished_product: 'Finished product',
};

export function itemTypeLabel(type: ItemType): string {
  return TYPE_LABEL[type];
}

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

export interface ItemRow {
  id: string;
  name: string;
  sku: string | null;
  item_type: ItemType;
  qty_on_hand: string;
  avg_unit_cost: string | null;
  reorder_point: string | null;
  archived_at: string | null;
  base_unit: { code: string; name: string } | null;
}

export interface UnitOption {
  id: string;
  code: string;
  name: string;
  dimension_code: string;
}

export interface ItemDetail extends ItemRow {
  brand: string | null;
  colour: string | null;
  description: string | null;
  notes: string | null;
  supplier_lead_time_days: number | null;
  purchase_to_base_factor: string | null;
  is_costed: boolean;
  created_at: string;
  purchase_unit: { code: string; name: string } | null;
}

/** The stock status badge, from the approved set. */
export type StockStatus = 'archived' | 'no_cost' | 'out_of_stock' | 'low' | 'in_stock';

export function stockStatus(item: ItemRow): { status: StockStatus; label: string } {
  if (item.archived_at !== null) return { status: 'archived', label: 'Archived' };
  if (item.avg_unit_cost === null) return { status: 'no_cost', label: 'No cost yet' };

  // Through decimal.js, not a float. `qty_on_hand` is numeric(20,6) and arrives
  // as a string; comparing 2300.000001 to a reorder point as a float is exactly
  // the drift D-079 bans.
  const onHand = toDecimal(item.qty_on_hand);
  if (onHand.lte(0)) return { status: 'out_of_stock', label: 'Out of stock' };
  if (item.reorder_point !== null && onHand.lte(toDecimal(item.reorder_point))) {
    return { status: 'low', label: 'Low' };
  }
  return { status: 'in_stock', label: 'In stock' };
}
