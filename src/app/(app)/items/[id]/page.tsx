import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { getItem } from '@/lib/items';
import { itemTypeLabel, stockStatus } from '@/lib/item-types';
import { Money } from '@/lib/money';
import { formatQuantity, formatRate, toDecimal } from '@/lib/decimal';
import { StatusBadge } from '@/components/ui/status-badge';
import { archiveItem, restoreItem } from '../../actions';

const TABS = ['Overview', 'Stock', 'Cost history', 'Movements', 'Used in'] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  return {
    title:
      item === null ? 'Item not found — Production Costing' : `${item.name} — Production Costing`,
  };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrg();
  const { id } = await params;
  const item = await getItem(id);

  // RLS means another org's item is indistinguishable from one that does not
  // exist, which is the right answer to give.
  if (item === null) {
    notFound();
  }

  const badge = stockStatus(item);
  const value =
    item.avg_unit_cost === null
      ? '—'
      : Money.fromDecimal(toDecimal(item.qty_on_hand).times(item.avg_unit_cost)).format();

  const readouts: Array<[string, string]> = [
    ['On hand', formatQuantity(item.qty_on_hand, item.base_unit?.code)],
    ['Unit cost', item.avg_unit_cost === null ? '—' : formatRate(item.avg_unit_cost)],
    ['Stock value', value],
    [
      'Reorder at',
      item.reorder_point === null ? '—' : formatQuantity(item.reorder_point, item.base_unit?.code),
    ],
    ['Type', itemTypeLabel(item.item_type)],
    [
      'Buying unit',
      item.purchase_unit === null ? 'Same as consuming unit' : item.purchase_unit.name,
    ],
  ];

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <p className="text-caption text-text-tertiary">
        <Link href="/items" className="underline">
          Items
        </Link>
        {'  ·  '}
        {item.name}
      </p>

      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-title text-text-primary">{item.name}</h1>
          <StatusBadge status={badge.status} label={badge.label} />
        </div>
        <form action={item.archived_at === null ? archiveItem : restoreItem}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            className="text-body h-control-md rounded-control bg-surface-sunken px-4 text-text-primary transition-colors duration-[120ms] hover:bg-border-strong"
          >
            {item.archived_at === null ? 'Archive item' : 'Restore item'}
          </button>
        </form>
      </div>

      {item.archived_at !== null ? (
        <p className="text-body-sm mt-4 rounded-card border border-border-strong bg-surface-sunken px-5 py-3 text-text-secondary">
          This item is archived. It no longer appears in pickers, and it stays on every movement,
          recipe, run and sale it was ever part of.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border-strong">
        {TABS.map((tab, i) => (
          <span
            key={tab}
            aria-current={i === 0 ? 'page' : undefined}
            className={`text-body cursor-default px-4 py-2.5 ${
              i === 0
                ? 'border-b-2 border-accent font-medium text-text-primary'
                : 'text-text-tertiary'
            }`}
            title={i === 0 ? undefined : 'Arrives with the inventory ledger at stage S4'}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {readouts.map(([label, text]) => (
          <div key={label} className="rounded-card border border-border-strong bg-surface p-5">
            <p className="text-micro text-text-tertiary">{label}</p>
            <p className="text-value-sm tabular mt-1 text-text-primary">{text}</p>
          </div>
        ))}
      </div>

      {item.avg_unit_cost === null ? (
        <div className="mt-4 rounded-card border border-border-strong bg-surface-accent p-5">
          <p className="text-micro text-accent-text">This item has no cost yet</p>
          <p className="text-body mt-1 max-w-[68ch] text-text-secondary">
            No cost yet. Record a purchase or an opening balance and a unit cost will be worked out
            from it.
          </p>
        </div>
      ) : null}

      {item.purchase_unit !== null && item.purchase_to_base_factor !== null ? (
        <p className="text-caption mt-4 max-w-[68ch] text-text-tertiary">
          One {item.purchase_unit.name.toLowerCase()} holds{' '}
          {formatQuantity(item.purchase_to_base_factor, item.base_unit?.code)}. Every purchase in{' '}
          {item.purchase_unit.name.toLowerCase()}s is converted through that figure before it
          reaches stock.
        </p>
      ) : null}

      <p className="text-caption mt-6 max-w-[68ch] text-text-tertiary">
        Cost history, movements and where this item is used all read from the inventory ledger,
        which arrives at stage S4. Until then there is nothing truthful to put on those tabs.
      </p>
    </main>
  );
}
