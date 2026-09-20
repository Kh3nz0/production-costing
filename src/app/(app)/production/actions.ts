'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/business-date';
import { getProduct, getProductCost } from '@/lib/products';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';

export interface RunActionState {
  error?: string;
  saved?: boolean;
}

function field(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

// Units are whole things, and D-079 bans the coercion that would turn the
// string into one. The digits are validated here and handed to Postgres as
// digits: an integer column casts them itself, with no float in between.
function whole(value: string, label: string): string {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number of units.`);
  return value;
}

export async function startRun(_previous: RunActionState, data: FormData): Promise<RunActionState> {
  let id: string;
  try {
    const org = await requireOrg();
    const itemId = field(data, 'item_id');
    if (!itemId) throw new Error('Choose a product to make.');
    const planned = field(data, 'planned_qty');
    if (!toDecimal(planned || '0').gt(0)) throw new Error('Plan at least one good unit.');
    const on = field(data, 'run_date') || businessDate(org.timezone);

    // The estimate is computed here, from the same code the Cost tab uses, so
    // the figure the run is judged against came from the server rather than
    // from whatever the browser was showing.
    const product = await getProduct(itemId, org.id);
    if (!product) throw new Error('Product not found.');
    const cost = await getProductCost(product, on);

    const db = await createClient();
    const result = await db.rpc('start_production_run', {
      p_item_id: itemId,
      p_planned_qty: planned,
      p_estimated_total_cost_cents:
        cost === null
          ? null
          : Money.fromDecimal(cost.fullExact.times(toDecimal(planned)))
              .toCentavos()
              .toString(),
      p_estimated_unit_cost: cost === null ? null : cost.inventoryExact.toFixed(8),
      p_run_date: on,
      p_notes: field(data, 'notes') || null,
    });
    if (result.error) throw new Error(result.error.message);
    id = result.data as unknown as string;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not start the run.' };
  }
  revalidatePath('/production');
  redirect(`/production/${id}`);
}

export async function completeRun(
  _previous: RunActionState,
  data: FormData,
): Promise<RunActionState> {
  const runId = field(data, 'run_id');
  try {
    await requireOrg();
    const accepted = whole(field(data, 'units_accepted'), 'Accepted units');
    const failed = whole(field(data, 'units_failed'), 'Failed units');

    const lines = JSON.parse(field(data, 'lines') || '[]') as {
      id: string;
      actual_qty: string;
    }[];
    const waste = JSON.parse(field(data, 'waste') || '[]') as {
      item_id: string;
      qty: string;
      reason: string;
    }[];

    const db = await createClient();
    const result = await db.rpc('complete_production_run', {
      p_run_id: runId,
      p_lines: lines
        .filter((line) => line.actual_qty !== '')
        .map((line) => ({ id: line.id, actual_qty: line.actual_qty })),
      p_units_accepted: accepted,
      p_units_failed: failed,
      p_waste: waste.filter((line) => line.item_id !== '' && line.qty !== ''),
      p_notes: field(data, 'notes') || null,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/production/${runId}`);
    revalidatePath('/production');
    revalidatePath('/inventory');
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not complete the run.' };
  }
}

export async function reverseRun(
  _previous: RunActionState,
  data: FormData,
): Promise<RunActionState> {
  const runId = field(data, 'run_id');
  try {
    await requireOrg();
    const reason = field(data, 'reason');
    if (!reason) throw new Error('A reversal needs a reason.');
    const db = await createClient();
    const result = await db.rpc('reverse_production_run', {
      p_run_id: runId,
      p_reason: reason,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/production/${runId}`);
    revalidatePath('/production');
    revalidatePath('/inventory');
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not reverse the run.' };
  }
}
