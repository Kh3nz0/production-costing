import Link from 'next/link';
import { AdjustForm, type AdjustableItem } from './adjust-form';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Adjust stock — Production Costing' };

export default async function AdjustPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireOrg();
  const mode = (await searchParams).mode === 'opening' ? 'opening' : 'adjust';

  const supabase = await createClient();
  const { data } = await supabase
    .from('items')
    .select(
      'id, name, qty_on_hand, base_unit:units!items_base_unit_id_fkey(code), inventory_movements(id)',
    )
    .is('archived_at', null)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, 499);

  const items: AdjustableItem[] = (
    (data ?? []) as unknown as Array<{
      id: string;
      name: string;
      qty_on_hand: string;
      base_unit: { code: string } | null;
      inventory_movements: Array<{ id: string }>;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    qty_on_hand: row.qty_on_hand,
    unit_code: row.base_unit?.code ?? null,
    has_history: row.inventory_movements.length > 0,
  }));

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <p className="text-caption text-text-tertiary">
        <Link href="/inventory" className="underline">
          Inventory
        </Link>
      </p>
      <h1 className="text-title mt-1 text-text-primary">
        {mode === 'opening' ? 'Record opening balances' : 'Adjust stock'}
      </h1>
      <p className="text-body mt-1 max-w-[68ch] text-text-secondary">
        {mode === 'opening'
          ? 'For stock you already own and are not entering a purchase for. Enter what is on the shelf and what you believe it cost.'
          : 'Use this when the real quantity differs from what the system shows: a count, a breakage, a mistake.'}
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">No items yet</p>
          <p className="text-body mt-1 text-text-secondary">
            Stock belongs to an item, so add one first.
          </p>
          <Link
            href="/items/new"
            className="text-body-sm mt-4 inline-block text-accent-text underline"
          >
            New item
          </Link>
        </div>
      ) : (
        <AdjustForm items={items} mode={mode} />
      )}

      <p className="text-caption mt-6 max-w-[68ch] text-text-tertiary">
        {mode === 'opening'
          ? 'An opening balance is only valid as an item’s first movement. Allowing one later would make it a way to set the average cost directly, and that figure has to stay derived from what you actually paid.'
          : 'An adjustment never changes the unit cost. Only a purchase does that, because only a purchase involves money changing hands.'}
      </p>
    </main>
  );
}
