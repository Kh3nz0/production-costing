'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrg } from '@/lib/org';
import { isItemType } from '@/lib/item-types';

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
