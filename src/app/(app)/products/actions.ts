'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';
import { businessDate } from '@/lib/business-date';
import { getChannelsWithFees, getProduct, getProductCost } from '@/lib/products';
import { channelTerms } from '@/lib/pricing-terms';
import { priceForChannel } from '@/lib/pricing';

export interface ProductActionState {
  error?: string;
  saved?: boolean;
}

function field(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
function optional(data: FormData, key: string): string | null {
  return field(data, key) || null;
}
function positive(value: string, label: string): string {
  if (!value || !toDecimal(value).gt(0)) throw new Error(`${label} must be above zero.`);
  return value;
}
function percentage(value: string, label: string): string | null {
  if (!value) return null;
  const fraction = toDecimal(value).div(100);
  if (fraction.lt(0) || fraction.gte(1)) throw new Error(`${label} must be below 100%.`);
  return fraction.toFixed(6);
}

export async function createProduct(
  _previous: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  let id: string;
  try {
    const org = await requireOrg();
    const name = field(data, 'name');
    const baseUnitId = field(data, 'base_unit_id');
    if (!name) throw new Error('Give the product a name.');
    if (!baseUnitId) throw new Error('Choose the finished unit.');
    const db = await createClient();
    const result = await db.rpc('create_product', {
      p_org_id: org.id,
      p_name: name,
      p_sku: optional(data, 'sku'),
      p_base_unit_id: baseUnitId,
      p_expected_failure_rate: percentage(field(data, 'failure_percent'), 'Expected failure'),
      p_output_qty:
        optional(data, 'output_qty') === null
          ? null
          : positive(field(data, 'output_qty'), 'Expected output'),
      p_target_margin: percentage(field(data, 'target_margin_percent'), 'Target margin'),
      p_minimum_margin: percentage(field(data, 'minimum_margin_percent'), 'Minimum margin'),
      p_description: optional(data, 'description'),
      p_variant: optional(data, 'variant'),
    });
    if (result.error) throw new Error(result.error.message);
    id = String(result.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create product.' };
  }
  revalidatePath('/products');
  redirect(`/products/${id}/recipe`);
}

interface SubmittedLine {
  line_type: string;
  ref_id: string;
  qty: string;
  unit_id: string;
  waste_percent: string;
  amount: string;
  notes: string;
}
const ITEM_TYPES = new Set(['material', 'component', 'packaging', 'subassembly']);

export async function saveRecipe(
  _previous: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  try {
    await requireOrg();
    const itemId = field(data, 'item_id');
    const raw = field(data, 'lines');
    const lines = JSON.parse(raw) as SubmittedLine[];
    if (!Array.isArray(lines) || lines.length === 0)
      throw new Error('Add at least one recipe line.');
    if (lines.length > 100) throw new Error('A recipe can have at most 100 lines.');
    const payload = lines.map((line) => {
      if (!line || typeof line !== 'object') throw new Error('A recipe line is invalid.');
      if (ITEM_TYPES.has(line.line_type)) {
        if (!line.ref_id || !line.unit_id)
          throw new Error('Choose an item and unit for each material line.');
        // F-05 adds waste to net quantity. Unlike failure, it can exceed 100%.
        const waste = toDecimal(line.waste_percent || '0').div(100);
        if (waste.lt(0)) throw new Error('Waste cannot be negative.');
        return {
          line_type: line.line_type,
          ref_item_id: line.ref_id,
          qty_per_unit: positive(line.qty, 'Quantity'),
          unit_id: line.unit_id,
          waste_rate: waste.toFixed(6),
          notes: line.notes || null,
        };
      }
      if (line.line_type === 'machine_time' || line.line_type === 'labour') {
        if (!line.ref_id) throw new Error('Choose equipment or an activity.');
        return {
          line_type: line.line_type,
          ref_equipment_id: line.line_type === 'machine_time' ? line.ref_id : null,
          ref_activity_id: line.line_type === 'labour' ? line.ref_id : null,
          qty_per_unit: positive(line.qty, 'Hours'),
          notes: line.notes || null,
        };
      }
      if (line.line_type === 'other_cost') {
        if (!line.amount?.trim()) throw new Error('Enter the amount for each other-cost line.');
        const cents = Money.parse(line.amount).toCentavos();
        if (cents < 0n) throw new Error('Other cost cannot be negative.');
        return {
          line_type: line.line_type,
          amount_cents: cents.toString(),
          notes: line.notes || null,
        };
      }
      throw new Error('Unknown recipe line type.');
    });
    const db = await createClient();
    const result = await db.rpc('save_product_recipe', {
      p_item_id: itemId,
      p_lines: payload,
      p_notes: optional(data, 'notes'),
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/products/${itemId}/recipe`);
    revalidatePath(`/products/${itemId}/cost`);
    revalidatePath('/products');
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save recipe.' };
  }
}

/**
 * The target margin. `percentage` already refuses 100% and above, which is the
 * same rule the database enforces and the same one `priceFromMargin` enforces:
 * a margin is measured against the price, so at 100% the price is infinite.
 */
export async function saveTargetMargin(
  _previous: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  const itemId = field(data, 'item_id');
  try {
    await requireOrg();
    const db = await createClient();
    const result = await db.rpc('save_product_pricing', {
      p_item_id: itemId,
      p_target_margin: percentage(field(data, 'target_margin_percent'), 'Target margin'),
      p_minimum_margin: percentage(field(data, 'minimum_margin_percent'), 'Minimum margin'),
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/products/${itemId}/pricing`);
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save the target margin.' };
  }
}

/**
 * A snapshot of what a price assumed. Every figure is recomputed on the server
 * from the product's own cost and the channel's dated fees: what the browser
 * displayed is not evidence of anything, and a snapshot exists to be evidence.
 */
export async function savePricingSnapshot(
  _previous: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  const itemId = field(data, 'item_id');
  try {
    const org = await requireOrg();
    const product = await getProduct(itemId, org.id);
    if (!product) throw new Error('Product not found.');

    const on = field(data, 'on') || businessDate(org.timezone);
    const cost = await getProductCost(product, on);
    if (!cost) throw new Error('This product has no recipe yet, so there is no cost to price.');

    const margin = percentage(field(data, 'target_margin_percent'), 'Target margin');
    if (margin === null) throw new Error('Enter a target margin first.');
    const discount = percentage(field(data, 'discount_percent'), 'Planned discount') ?? '0';

    const channels = await getChannelsWithFees(org.id, on);
    const channelId = optional(data, 'channel_id');
    const channel = channelId === null ? null : channels.find((c) => c.id === channelId);
    if (channelId !== null && channel === undefined) throw new Error('Channel not found.');

    const terms = channelTerms(channel ?? null, discount);
    const priced = priceForChannel(
      Money.fromDecimal(cost.fullExact),
      Money.fromDecimal(cost.inventoryExact),
      margin,
      terms,
    );
    if (!priced.ok) throw new Error(priced.reason);

    const db = await createClient();
    const result = await db.rpc('save_pricing_snapshot', {
      p_item_id: itemId,
      p_channel_id: channelId,
      p_pricing_unit_cost: cost.fullExact.toFixed(8),
      p_inventory_unit_cost: cost.inventoryExact.toFixed(8),
      p_target_margin: margin,
      p_expected_contribution_margin: priced.value.contributionMargin.toFixed(6),
      p_list_price_cents: priced.value.price.toCentavos().toString(),
      p_break_even_contribution_cents: priced.value.breakEvenContribution.toCentavos().toString(),
      p_break_even_overhead_cents: priced.value.breakEvenWithOverhead.toCentavos().toString(),
      // The terms by value. An id alone would not survive the fee version being
      // superseded, which is exactly when this gets read.
      p_inputs: {
        rate_date: on,
        channel_name: channel?.name ?? 'Direct',
        commission_rate: channel?.commissionRate ?? '0',
        payment_rate: channel?.paymentRate ?? '0',
        fixed_fee_cents: channel?.fixedFeeCents ?? '0',
        fee_version_effective_from: channel?.effectiveFrom ?? null,
        discount_rate: discount,
      },
      p_notes: optional(data, 'notes'),
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/products/${itemId}/pricing`);
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save the snapshot.' };
  }
}
