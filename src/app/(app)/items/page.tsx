import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listItems } from '@/lib/items';
import { itemTypeLabel, stockStatus, TYPE_FILTERS, type ItemRow } from '@/lib/item-types';
import { Money } from '@/lib/money';
import { formatQuantity, formatRate, toDecimal } from '@/lib/decimal';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata = { title: 'Items — Production Costing' };

function stockValue(item: ItemRow): string {
  if (item.avg_unit_cost === null) return '—';
  return Money.fromDecimal(toDecimal(item.qty_on_hand).times(item.avg_unit_cost)).format();
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; archived?: string }>;
}) {
  await requireOrg();
  const params = await searchParams;
  const activeType = params.type ?? 'all';
  const search = params.q ?? '';
  const showArchived = params.archived === '1';

  const { rows, error } = await listItems({
    type: activeType,
    q: search,
    showArchived,
  });

  // Typed routes verify route literals, and these query strings are assembled
  // at runtime from the current filter state. The path is always `/items`; only
  // the query varies, so there is no route to get wrong.
  type LinkHref = React.ComponentProps<typeof Link>['href'];

  const href = (next: Record<string, string | undefined>): LinkHref => {
    const sp = new URLSearchParams();
    const merged = { type: activeType, q: search, archived: showArchived ? '1' : '', ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '' && !(k === 'type' && v === 'all')) sp.set(k, v);
    }
    const qs = sp.toString();
    return (qs === '' ? '/items' : `/items?${qs}`) as LinkHref;
  };

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">Items</h1>
          <p className="text-body mt-1 text-text-secondary">
            Everything you buy, make or keep in stock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-body inline-flex h-control-md cursor-default items-center rounded-control bg-surface-sunken px-4 text-text-tertiary"
            title="Bulk import arrives at stage S12"
          >
            Import items
          </span>
          <Link
            href="/items/new"
            className="text-body inline-flex h-control-md items-center rounded-control bg-accent px-4 font-medium text-text-inverse transition-colors duration-[120ms] ease-out hover:bg-accent-hover"
          >
            New item
          </Link>
        </div>
      </div>

      <form action="/items" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-text-secondary">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by name or SKU"
            className="h-field w-[280px] rounded-control border border-border-control bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary"
          />
        </label>
        {activeType !== 'all' ? <input type="hidden" name="type" value={activeType} /> : null}
        {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
        <button
          type="submit"
          className="text-body h-control-md rounded-control bg-surface-sunken px-4 text-text-primary transition-colors duration-[120ms] hover:bg-border-strong"
        >
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((filter) => {
          const isActive = filter.value === activeType;
          return (
            <Link
              key={filter.value}
              href={href({ type: filter.value })}
              aria-current={isActive ? 'true' : undefined}
              className={`text-body-sm rounded-pill px-3 py-1.5 transition-colors duration-[120ms] ${
                isActive
                  ? 'bg-surface-accent font-medium text-accent-text'
                  : 'bg-surface text-text-secondary ring-1 ring-border-strong hover:bg-surface-sunken'
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
        <Link
          href={href({ archived: showArchived ? '' : '1' })}
          className={`text-body-sm ml-auto rounded-pill px-3 py-1.5 transition-colors duration-[120ms] ${
            showArchived
              ? 'bg-surface-accent font-medium text-accent-text'
              : 'bg-surface text-text-secondary ring-1 ring-border-strong hover:bg-surface-sunken'
          }`}
        >
          Show archived
        </Link>
      </div>

      {error !== null ? (
        <p role="alert" className="text-body mt-6 text-danger">
          Could not load your items. {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">
            {search !== '' || activeType !== 'all' ? 'Nothing matches that' : 'No items yet'}
          </p>
          <p className="text-body mt-1 text-text-secondary">
            {search !== '' || activeType !== 'all'
              ? 'Try a different search or clear the filter.'
              : 'Add the first thing you buy or make, and its cost follows from your purchases.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="bg-surface-sunken">
                {['Item', 'Type', 'On hand', 'Unit cost', 'Value', 'Status'].map((h) => (
                  <th key={h} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const badge = stockStatus(item);
                return (
                  <tr key={item.id} className="border-t border-border-strong">
                    <td className="px-5 py-3">
                      <Link
                        href={`/items/${item.id}`}
                        className="text-body-sm text-text-primary underline-offset-2 hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.sku !== null ? (
                        <span className="text-mono-sm ml-2 text-text-tertiary">{item.sku}</span>
                      ) : null}
                    </td>
                    <td className="text-body-sm px-5 py-3 text-text-secondary">
                      {itemTypeLabel(item.item_type)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {formatQuantity(item.qty_on_hand, item.base_unit?.code)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {item.avg_unit_cost === null ? '—' : formatRate(item.avg_unit_cost)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {stockValue(item)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={badge.status} label={badge.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-caption mt-4 text-text-tertiary">
        {rows.length} {rows.length === 1 ? 'item' : 'items'}. A unit cost appears after the first
        costed purchase, which is why a new item shows no cost yet.
      </p>
    </main>
  );
}
