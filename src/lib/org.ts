import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface Org {
  id: string;
  name: string;
  currency_code: string;
  vat_registered: boolean;
  vat_rate: string;
}

/** The caller's organization, or null if they are not in one yet. */
export async function getCurrentOrg(): Promise<Org | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('id, name, currency_code, vat_registered, vat_rate')
    .is('archived_at', null)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, 0);
  return (data?.[0] as Org | undefined) ?? null;
}

/**
 * For a screen that cannot mean anything without an organization. Everything in
 * this system is org-scoped, so an item, a purchase or a run has nowhere to live
 * until one exists.
 */
export async function requireOrg(): Promise<Org> {
  const org = await getCurrentOrg();
  if (org === null) {
    redirect('/setup');
  }
  return org;
}
