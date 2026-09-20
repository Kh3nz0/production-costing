import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listItems } from '@/lib/items';
import { itemTypeLabel, stockStatus } from '@/lib/item-types';
import { Money } from '@/lib/money';
import { formatQuantity, formatRate, toDecimal } from '@/lib/decimal';
import { StatusBadge } from '@/components/ui/status-badge';
import { InventoryHeader, InventoryTabs } from '@/components/inventory-tabs';

export const metadata = { title: 'Inventory' };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string }>;
}) {
  await requireOrg();
  const lowOnly = (await searchParams).low === '1';
  const { rows, error } = await listItems();

  const shown = lowOnly
    ? rows.filter((r) => {
        const s = stockStatus(r).status;
        return s === 'low' || s === 'out_of_stock';
      })
    : rows;

  const totalValue = Money.sum(
    shown.map((r) =>
      r.avg_unit_cost === null
        ? Money.ZERO
        : Money.fromDecimal(toDecimal(r.qty_on_hand).times(r.avg_unit_cost)),
    ),
  );
  const uncosted = shown.filter((r) => r.avg_unit_cost === null).length;

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <InventoryHeader />
      <InventoryTabs current="/inventory" />

      <div className="mt-4">
        <Link
          href={lowOnly ? '/inventory' : '/inventory?low=1'}
          className={`text-body-sm rounded-pill px-3 py-1.5 transition-colors duration-fast ${
            lowOnly
              ? 'bg-surface-accent font-medium text-accent-text'
              : 'bg-surface text-text-secondary ring-1 ring-border-strong hover:bg-surface-sunken'
          }`}
        >
          Low stock only
        </Link>
      </div>

      {error !== null ? (
        <p role="alert" className="text-body mt-6 text-danger">
          Could not load your stock. {error}
        </p>
      ) : shown.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">
            {lowOnly ? 'Nothing is low' : 'Nothing in stock yet'}
          </p>
          <p className="text-body mt-1 text-text-secondary">
            {lowOnly
              ? 'Every item is above its reorder point.'
              : 'Receive a purchase or record an opening balance and it appears here.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          {/* Read down on a phone, across on a desktop. Seven columns at 390px
              is either a crush or a sideways scroll, and both hide something. */}
          <ul className="divide-y divide-border-strong lg:hidden">
            {shown.map((item) => {
              const badge = stockStatus(item);
              const unit = item.base_unit?.code;
              return (
                <li key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/items/${item.id}`}
                      className="text-body font-medium text-text-primary underline-offset-2"
                    >
                      {item.name}
                    </Link>
                    <StatusBadge status={badge.status} label={badge.label} />
                  </div>
                  <p className="text-caption mt-1 text-text-secondary">
                    {itemTypeLabel(item.item_type)}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    {(
                      [
                        ['On hand', formatQuantity(item.qty_on_hand, unit)],
                        [
                          'Unit cost',
                          item.avg_unit_cost === null ? '—' : formatRate(item.avg_unit_cost),
                        ],
                        [
                          'Reorder at',
                          item.reorder_point === null
                            ? '—'
                            : formatQuantity(item.reorder_point, unit),
                        ],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-caption text-text-tertiary">{label}</dt>
                        <dd className="text-body-sm tabular text-text-primary">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>

          <table className="hidden w-full min-w-[40rem] text-left lg:table">
            <thead>
              <tr className="bg-surface-sunken">
                {['Item', 'Type', 'On hand', 'Unit cost', 'Value', 'Reorder at', 'Status'].map(
                  (h) => (
                    <th key={h} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const badge = stockStatus(item);
                const unit = item.base_unit?.code;
                return (
                  <tr key={item.id} className="border-t border-border-strong">
                    <td className="px-5 py-3">
                      <Link
                        href={`/items/${item.id}`}
                        className="text-body-sm text-text-primary underline-offset-2 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="text-body-sm px-5 py-3 text-text-secondary">
                      {itemTypeLabel(item.item_type)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {formatQuantity(item.qty_on_hand, unit)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {item.avg_unit_cost === null ? '—' : formatRate(item.avg_unit_cost)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {item.avg_unit_cost === null
                        ? '—'
                        : Money.fromDecimal(
                            toDecimal(item.qty_on_hand).times(item.avg_unit_cost),
                          ).format()}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-tertiary">
                      {item.reorder_point === null ? '—' : formatQuantity(item.reorder_point, unit)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={badge.status} label={badge.label} />
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border-strong bg-surface-sunken">
                <th scope="row" colSpan={4} className="text-heading-sm px-5 py-3 text-text-primary">
                  Total inventory value
                </th>
                <td className="text-heading-sm tabular px-5 py-3 text-text-primary">
                  {totalValue.format()}
                </td>
                <td colSpan={2} className="text-caption px-5 py-3 text-text-tertiary">
                  across {shown.length} {shown.length === 1 ? 'item' : 'items'}
                  {uncosted > 0 ? `, ${uncosted} with no cost yet` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {uncosted > 0 ? (
        <p className="text-caption mt-4 max-w-[68ch] text-text-tertiary">
          Stock with no known cost contributes nothing to the total. That is deliberate: it is not
          worth nothing, it is worth an amount nobody has established yet, and a guess in a total is
          worse than a gap.
        </p>
      ) : null}
    </main>
  );
}
