'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrg } from '@/lib/org';
import { isItemType } from '@/lib/item-types';
import { Money } from '@/lib/money';

export interface ActionState {
  error?: string;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optional(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value === '' ? null : value;
}

/**
 * Founding the organization.
 *
 * Pulled forward from the onboarding flow at S13 because nothing else in the
 * system can exist without it: every table is org-scoped, so there is nowhere to
 * put an item until an org does. The full onboarding — equipment, labour,
 * overhead, channels — still belongs to S13.
 */
export async function createOrganization(_prev: ActionState, form: FormData): Promise<ActionState> {
  const name = text(form, 'name');
  if (name === '') {
    return { error: 'Give your business a name.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_organization', { p_name: name });
  if (error !== null) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function createItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  const org = await requireOrg();

  const name = text(form, 'name');
  const itemType = text(form, 'item_type');
  const baseUnitId = text(form, 'base_unit_id');
  const purchaseUnitId = optional(form, 'purchase_unit_id');
  const factor = optional(form, 'purchase_to_base_factor');

  if (name === '') return { error: 'Give the item a name.' };
  if (!isItemType(itemType)) return { error: 'Choose what kind of item this is.' };
  if (baseUnitId === '') return { error: 'Choose the unit you consume it in.' };

  // The database refuses this too, but saying it here names the field rather
  // than surfacing a constraint name.
  if (purchaseUnitId !== null && purchaseUnitId !== baseUnitId && factor === null) {
    return {
      error:
        'Enter how much of the consuming unit is in one buying unit. A 1 kg filament spool holds 1000 g, so enter 1000.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('items').insert({
    org_id: org.id,
    name,
    sku: optional(form, 'sku'),
    item_type: itemType,
    base_unit_id: baseUnitId,
    purchase_unit_id: purchaseUnitId,
    purchase_to_base_factor: factor,
    brand: optional(form, 'brand'),
    colour: optional(form, 'colour'),
    description: optional(form, 'description'),
    notes: optional(form, 'notes'),
    reorder_point: optional(form, 'reorder_point'),
    supplier_lead_time_days: optional(form, 'supplier_lead_time_days'),
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });

  if (error !== null) {
    if (error.code === '23505' || /items_org_sku_unique/.test(error.message)) {
      return { error: 'That SKU is already used by another item.' };
    }
    return { error: error.message };
  }

  revalidatePath('/items');
  redirect('/items');
}

/** Archive, never delete. The item stays on every movement, recipe, run and sale. */
export async function archiveItem(form: FormData): Promise<void> {
  const id = text(form, 'id');
  const supabase = await createClient();
  const { error } = await supabase
    .from('items')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error !== null) {
    throw new Error(`Could not archive that item: ${error.message}`);
  }

  revalidatePath('/items');
  revalidatePath(`/items/${id}`);
}

export async function restoreItem(form: FormData): Promise<void> {
  const id = text(form, 'id');
  const supabase = await createClient();
  const { error } = await supabase
    .from('items')
    .update({ archived_at: null })
    .eq('id', id)
    .select('id');

  if (error !== null) {
    throw new Error(`Could not restore that item: ${error.message}`);
  }

  revalidatePath('/items');
  revalidatePath(`/items/${id}`);
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

/**
 * Centavos as a string, not a number. bigint to number would be a silent
 * precision cliff at 2^53, and D-079 bans the coercion outright; PostgREST
 * accepts a numeric string for a bigint column.
 */
function cents(form: FormData, key: string): string {
  const raw = text(form, key);
  if (raw === '') return '0';
  return Money.parse(raw).toCentavos().toString();
}

interface DraftLine {
  item_id: string;
  qty: string;
  unit_id: string;
  price: string;
  weight: string | null;
}

function draftLines(form: FormData): DraftLine[] {
  const items = form.getAll('line_item_id').map(String);
  const qtys = form.getAll('line_qty').map(String);
  const units = form.getAll('line_unit_id').map(String);
  const prices = form.getAll('line_price').map(String);
  const weights = form.getAll('line_weight').map(String);

  const out: DraftLine[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i] ?? '';
    const qty = qtys[i] ?? '';
    if (item === '' || qty === '') continue;
    out.push({
      item_id: item,
      qty,
      unit_id: units[i] ?? '',
      price: prices[i] ?? '0',
      weight: (weights[i] ?? '') === '' ? null : (weights[i] ?? null),
    });
  }
  return out;
}

export async function createPurchase(_prev: ActionState, form: FormData): Promise<ActionState> {
  const org = await requireOrg();
  const lines = draftLines(form);

  if (lines.length === 0) {
    return { error: 'Add at least one line before saving.' };
  }
  const purchaseDate = text(form, 'purchase_date');
  if (purchaseDate === '') {
    return { error: 'Enter the purchase date.' };
  }

  const supabase = await createClient();
  const userId = (await supabase.auth.getUser()).data.user?.id;

  const { data, error } = await supabase
    .from('purchases')
    .insert({
      org_id: org.id,
      supplier_id: optional(form, 'supplier_id'),
      reference_no: optional(form, 'reference_no'),
      purchase_date: purchaseDate,
      supplier_shipping_cents: cents(form, 'supplier_shipping'),
      duties_cents: cents(form, 'duties'),
      other_landed_cost_cents: cents(form, 'other_landed_cost'),
      discount_cents: cents(form, 'discount'),
      landed_cost_base: text(form, 'landed_cost_base') || 'value',
      notes: optional(form, 'notes'),
      created_by: userId,
    })
    .select('id')
    .single();

  if (error !== null || data === null) {
    if (error?.code === '23505' || /purchases_reference_unique/.test(error?.message ?? '')) {
      return { error: 'That reference number is already used by another purchase.' };
    }
    return { error: error?.message ?? 'Could not save that purchase.' };
  }

  const { error: lineError } = await supabase.from('purchase_lines').insert(
    lines.map((line) => ({
      org_id: org.id,
      purchase_id: data.id,
      item_id: line.item_id,
      qty_ordered: line.qty,
      qty_received: line.qty,
      purchase_unit_id: line.unit_id,
      unit_price_cents: Money.parse(line.price).toCentavos().toString(),
      line_weight: line.weight,
      created_by: userId,
    })),
  );

  if (lineError !== null) {
    return { error: lineError.message };
  }

  revalidatePath('/purchases');
  redirect(`/purchases/${data.id}` as Parameters<typeof redirect>[0]);
}

/**
 * Receiving is one RPC because it has to be one transaction: every line becomes
 * a ledger movement and every affected item's cached balance is rewritten from
 * the same numbers. A client-side sequence of writes cannot hold the item lock
 * that makes the weighted average safe (D-078).
 */
export async function receivePurchase(form: FormData): Promise<void> {
  const id = text(form, 'id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('receive_purchase', { p_purchase_id: id });

  if (error !== null) {
    throw new Error(error.message);
  }

  revalidatePath('/purchases');
  revalidatePath(`/purchases/${id}`);
  revalidatePath('/items');
}
