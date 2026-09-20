import { createClient } from '@/lib/supabase/server';
import type { LandedCostBase, PurchaseStatus } from '@/lib/purchase-types';

export interface PurchaseRow {
  id: string;
  reference_no: string | null;
  purchase_date: string;
  status: PurchaseStatus;
  landed_cost_base: LandedCostBase;
  supplier_shipping_cents: string;
  duties_cents: string;
  other_landed_cost_cents: string;
  discount_cents: string;
  supplier: { name: string } | null;
}

export async function listPurchases(): Promise<{ rows: PurchaseRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, reference_no, purchase_date, status, landed_cost_base, supplier_shipping_cents::text, duties_cents::text, other_landed_cost_cents::text, discount_cents::text, supplier:suppliers(name)',
    )
    .is('archived_at', null)
    .order('purchase_date', { ascending: false })
    .order('id', { ascending: false })
    .range(0, 499);

  if (error !== null) return { rows: [], error: error.message };
  return { rows: (data ?? []) as unknown as PurchaseRow[], error: null };
}

export interface PurchaseLineRow {
  id: string;
  item_id: string;
  qty_ordered: string;
  qty_received: string | null;
  unit_price_cents: string;
  line_discount_cents: string;
  line_weight: string | null;
  allocated_landed_cost_cents: string | null;
  landed_total_cents: string | null;
  receipt_unit_cost: string | null;
  item: {
    name: string;
    base_unit: { code: string } | null;
    purchase_to_base_factor: string | null;
  } | null;
  purchase_unit: { code: string; name: string; dimension_code: string } | null;
}

export interface PurchaseDetail extends PurchaseRow {
  notes: string | null;
  received_at: string | null;
  lines: PurchaseLineRow[];
}

export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('purchases')
    .select(
      `id, reference_no, purchase_date, status, landed_cost_base, notes, received_at,
       supplier_shipping_cents::text, duties_cents::text, other_landed_cost_cents::text, discount_cents::text,
       supplier:suppliers(name),
       lines:purchase_lines(
         id, item_id, qty_ordered::text, qty_received::text, unit_price_cents::text, line_discount_cents::text,
         line_weight::text, allocated_landed_cost_cents::text, landed_total_cents::text, receipt_unit_cost::text,
         item:items(name, purchase_to_base_factor::text, base_unit:units!items_base_unit_id_fkey(code)),
         purchase_unit:units!purchase_lines_purchase_unit_id_fkey(code, name, dimension_code)
       )`,
    )
    .eq('id', id)
    .maybeSingle();

  return (data as unknown as PurchaseDetail) ?? null;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export async function listSuppliers(): Promise<SupplierOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .is('archived_at', null)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, 499);
  return (data ?? []) as SupplierOption[];
}

export interface PurchasableItem {
  id: string;
  name: string;
  purchase_to_base_factor: string | null;
  base_unit: { code: string; name: string } | null;
  purchase_unit: { id: string; code: string; name: string; dimension_code: string } | null;
}

/** Items a purchase line can name, with everything the preview needs. */
export async function listPurchasableItems(): Promise<PurchasableItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('items')
    .select(
      'id, name, purchase_to_base_factor::text, base_unit:units!items_base_unit_id_fkey(code, name), purchase_unit:units!items_purchase_unit_id_fkey(id, code, name, dimension_code)',
    )
    .is('archived_at', null)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, 499);
  return (data ?? []) as unknown as PurchasableItem[];
}
