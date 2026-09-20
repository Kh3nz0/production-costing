'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/business-date';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';
import { getProduct, getProductCost } from '@/lib/products';

export interface SaleActionState {
  error?: string;
  saved?: boolean;
}

function field(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** Blank is zero here: an untouched money field means nothing was charged. */
function cents(value: string): string {
  return value === '' ? '0' : Money.parse(value).toCentavos().toString();
}

export async function recordSale(
  _previous: SaleActionState,
  data: FormData,
): Promise<SaleActionState> {
  try {
    const org = await requireOrg();
    const lines = JSON.parse(field(data, 'lines') || '[]') as {
      item_id: string;
      quantity: string;
      unit_price: string;
      discount: string;
    }[];
    const kept = lines.filter((line) => line.item_id !== '' && line.quantity !== '');
    if (kept.length === 0) throw new Error('A sale needs at least one line.');

    const db = await createClient();
    const payload = [];
    for (const line of kept) {
      const entry: Record<string, string> = {
        item_id: line.item_id,
        quantity: line.quantity,
        unit_price_cents: cents(line.unit_price),
        line_discount_cents: cents(line.discount),
      };
      payload.push(entry);
    }

    // The estimate override, when the person chose it. Computed here from the
    // product's own recipe and dated rates, never taken from the browser: a
    // sale's cost is evidence, and a number the page sent is not.
    if (field(data, 'use_estimate') === 'yes') {
      const on = field(data, 'sale_date') || businessDate(org.timezone);
      for (const entry of payload) {
        const product = await getProduct(entry.item_id!, org.id);
        if (!product) continue;
        const cost = await getProductCost(product, on);
        if (cost === null) {
          throw new Error(
            'That product has no recipe, so there is no estimate to fall back on. Record a production run first.',
          );
        }
        entry.estimated_unit_cogs = cost.inventoryExact.toFixed(8);
      }
    }

    const result = await db.rpc('record_sale', {
      p_sale: {
        org_id: org.id,
        sale_date: field(data, 'sale_date') || businessDate(org.timezone),
        reference_no: field(data, 'reference_no'),
        customer_name: field(data, 'customer_name'),
        channel_id: field(data, 'channel_id') || null,
        commission_fee_cents: cents(field(data, 'commission')),
        payment_fee_cents: cents(field(data, 'payment_fee')),
        other_costs_cents: cents(field(data, 'other_costs')),
        shipping_charged_cents: cents(field(data, 'shipping_charged')),
        shipping_cost_cents: cents(field(data, 'shipping_paid')),
        payment_status: field(data, 'payment_status') || 'unpaid',
        fulfilment_status: field(data, 'fulfilment_status') || 'unfulfilled',
        notes: field(data, 'notes'),
      },
      p_lines: payload,
    });
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not record the sale.' };
  }
  revalidatePath('/sales');
  revalidatePath('/inventory');
  redirect('/sales');
}

export async function setSaleStatus(
  _previous: SaleActionState,
  data: FormData,
): Promise<SaleActionState> {
  try {
    await requireOrg();
    const db = await createClient();
    const result = await db.rpc('set_sale_status', {
      p_sale_id: field(data, 'sale_id'),
      p_payment: field(data, 'payment_status') || null,
      p_fulfilment: field(data, 'fulfilment_status') || null,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/sales');
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update the sale.' };
  }
}

export async function estimateFor(itemId: string, on: string): Promise<string | null> {
  const org = await requireOrg();
  const product = await getProduct(itemId, org.id);
  if (!product) return null;
  const cost = await getProductCost(product, on);
  return cost === null ? null : toDecimal(cost.inventoryExact).toFixed(8);
}
