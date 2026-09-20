'use server';

import { revalidatePath } from 'next/cache';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { Money } from '@/lib/money';
import { toDecimal } from '@/lib/decimal';

function field(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
function optional(data: FormData, key: string): string | null {
  return field(data, key) || null;
}
function cents(data: FormData, key: string): string {
  return Money.parse(field(data, key) || '0')
    .toCentavos()
    .toString();
}
function positive(data: FormData, key: string): string {
  const value = field(data, key);
  if (!value || !toDecimal(value).gt(0)) throw new Error(`${key} must be above zero.`);
  return value;
}
function nonnegative(data: FormData, key: string): string {
  const value = field(data, key) || '0';
  if (toDecimal(value).lt(0)) throw new Error(`${key} cannot be negative.`);
  return value;
}
function date(data: FormData): string {
  const value = field(data, 'effective_from');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose an effective date.');
  return value;
}

export interface SettingsState {
  error?: string;
  saved?: boolean;
}

export async function saveSetting(
  _previous: SettingsState,
  data: FormData,
): Promise<SettingsState> {
  try {
    await saveSettingOrThrow(data);
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save this setting.' };
  }
}

async function saveSettingOrThrow(data: FormData): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  const common = { org_id: org.id, created_by: user?.id };
  const kind = field(data, 'kind');
  let error: { message: string } | null = null;

  switch (kind) {
    case 'business': {
      const name = field(data, 'name');
      if (!name) throw new Error('Give your business a name.');
      ({ error } = await supabase
        .from('organizations')
        .update({
          name,
          locale: field(data, 'locale') || 'en-PH',
          timezone: field(data, 'timezone') || 'Asia/Manila',
          vat_registered: field(data, 'vat_registered') === 'on',
        })
        .eq('id', org.id)
        .select('id')
        .single());
      break;
    }
    case 'equipment': {
      const name = field(data, 'name');
      if (!name) throw new Error('Give the equipment a name.');
      ({ error } = await supabase.from('equipment').insert({
        ...common,
        name,
        category: optional(data, 'category'),
        purchase_price_cents: cents(data, 'purchase_price'),
        purchase_date: optional(data, 'purchase_date'),
        measured_avg_power_watts: optional(data, 'measured_avg_power_watts'),
        notes: optional(data, 'notes'),
      }));
      break;
    }
    case 'equipment_details': {
      const name = field(data, 'name');
      if (!name) throw new Error('Give the equipment a name.');
      const power = optional(data, 'measured_avg_power_watts');
      if (power !== null && toDecimal(power).lt(0))
        throw new Error('Power draw cannot be negative.');
      ({ error } = await supabase
        .from('equipment')
        .update({
          name,
          purchase_price_cents: cents(data, 'purchase_price'),
          measured_avg_power_watts: power,
        })
        .eq('org_id', org.id)
        .eq('id', field(data, 'equipment_id'))
        .select('id')
        .single());
      break;
    }
    case 'equipment_rate': {
      ({ error } = await supabase.rpc('add_equipment_rate', {
        p_equipment_id: field(data, 'equipment_id'),
        p_effective_from: date(data),
        p_period_months: positive(data, 'period_months'),
        p_productive_hours: positive(data, 'productive_hours'),
        p_maintenance_cents: cents(data, 'maintenance'),
        p_repairs_cents: cents(data, 'repairs'),
        p_notes: optional(data, 'notes'),
      }));
      break;
    }
    case 'utility_rate': {
      ({ error } = await supabase.from('utility_rates').insert({
        ...common,
        utility_type: field(data, 'utility_type') || 'electricity',
        rate_per_unit: nonnegative(data, 'rate_per_unit'),
        unit_id: field(data, 'unit_id'),
        effective_from: date(data),
        source_reference: optional(data, 'source_reference'),
      }));
      break;
    }
    case 'activity': {
      const name = field(data, 'name');
      if (!name) throw new Error('Name the activity.');
      ({ error } = await supabase.from('labor_activities').insert({
        ...common,
        name,
        attended: field(data, 'attended') === 'on',
      }));
      break;
    }
    case 'labour_rate': {
      ({ error } = await supabase.from('labor_rate_versions').insert({
        ...common,
        activity_id: field(data, 'activity_id'),
        hourly_rate: nonnegative(data, 'hourly_rate'),
        effective_from: date(data),
        notes: optional(data, 'notes'),
      }));
      break;
    }
    case 'overhead': {
      const hours = positive(data, 'expected_hours');
      const ids = data.getAll('category_id').map(String);
      const amounts = data.getAll('category_amount').map(String);
      if (ids.length === 0 || ids.length !== amounts.length)
        throw new Error('Add an overhead category.');
      const lines = ids.map((category_id, index) => ({
        category_id,
        amount_cents: Money.parse(amounts[index] || '0')
          .toCentavos()
          .toString(),
      }));
      ({ error } = await supabase.rpc('add_overhead_version', {
        p_org_id: org.id,
        p_effective_from: date(data),
        p_expected_hours: hours,
        p_lines: lines,
      }));
      break;
    }
    case 'overhead_category': {
      const name = field(data, 'name');
      if (!name) throw new Error('Name the overhead category.');
      ({ error } = await supabase.from('overhead_categories').insert({ ...common, name }));
      break;
    }
    case 'channel': {
      const name = field(data, 'name');
      if (!name) throw new Error('Name the sales channel.');
      ({ error } = await supabase.from('sales_channels').insert({ ...common, name }));
      break;
    }
    case 'channel_rate': {
      ({ error } = await supabase.from('channel_fee_versions').insert({
        ...common,
        channel_id: field(data, 'channel_id'),
        effective_from: date(data),
        commission_rate: toDecimal(nonnegative(data, 'commission_percent')).div(100).toFixed(6),
        payment_rate: toDecimal(nonnegative(data, 'payment_percent')).div(100).toFixed(6),
        fixed_fee_cents: cents(data, 'fixed_fee'),
        notes: optional(data, 'notes'),
      }));
      break;
    }
    default:
      throw new Error('Unknown setting.');
  }
  if (error) throw new Error(error.message);
  revalidatePath('/settings', 'layout');
}
