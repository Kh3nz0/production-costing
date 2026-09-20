import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listMovements } from '@/lib/stock';
import { MOVEMENT_LABEL, movementLabel, type MovementType } from '@/lib/stock-types';
import { Money } from '@/lib/money';
import { formatQuantity, formatRate, toDecimal } from '@/lib/decimal';
import { InventoryHeader, InventoryTabs } from '@/components/inventory-tabs';

export const metadata = { title: 'Inventory movements — Production Costing' };

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  await requireOrg();
  const params = await searchParams;
  const { rows, error } = await listMovements(params);

  const signed = (value: string): string => {
    const d = toDecimal(value);
    const text = formatQuantity(d.abs());
    return `${d.isNegative() ? '−' : '+'}${text}`;
  };

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <InventoryHeader />
      <InventoryTabs current="/inventory/movements" />

      <p className="text-body mt-4 max-w-[68ch] text-text-secondary">
        Every change to stock, in order. Nothing here is ever edited or removed; corrections are
        recorded as their own entry.
      </p>

      <form action="/inventory/movements" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-text-secondary">Type</span>
          <select
            name="type"
            defaultValue={params.type ?? ''}
            className="h-field rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
          >
            <option value="">All types</option>
            {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => (
              <option key={t} value={t}>
                {movementLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-text-secondary">From</span>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            className="h-field rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-text-secondary">To</span>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            className="h-field rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
          />
        </label>
        <button
          type="submit"
          className="text-body h-control-md rounded-control bg-surface-sunken px-4 text-text-primary transition-colors duration-fast hover:bg-border-strong"
        >
          Filter
        </button>
        {params.type !== undefined || params.from !== undefined || params.to !== undefined ? (
          <Link href="/inventory/movements" className="text-body-sm text-text-secondary underline">
            Clear
          </Link>
        ) : null}
      </form>

      {error !== null ? (
        <p role="alert" className="text-body mt-6 text-danger">
          Could not load the movements. {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">Nothing has moved yet</p>
          <p className="text-body mt-1 text-text-secondary">
            Receiving a purchase, recording an opening balance or adjusting stock all appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="bg-surface-sunken">
                {[
                  'Date',
                  'Item',
                  'Type',
                  'Change',
                  'Balance after',
                  'Unit cost',
                  'Value effect',
                  'Why',
                ].map((h) => (
                  <th key={h} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const unit = row.item?.base_unit?.code;
                const effect =
                  row.cost_effect_cents === null
                    ? null
                    : Money.fromCentavos(BigInt(row.cost_effect_cents));
                return (
                  <tr key={row.id} className="border-t border-border-strong">
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {row.occurred_at.slice(0, 10)}
                    </td>
                    <td className="text-body-sm px-5 py-3 text-text-primary">
                      {row.item?.name ?? '—'}
                    </td>
                    <td className="text-body-sm px-5 py-3 text-text-secondary">
                      {movementLabel(row.movement_type)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {signed(row.quantity_change)} {unit ?? ''}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {formatQuantity(row.resulting_qty, unit)}
                    </td>
                    <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                      {row.unit_cost_at_movement === null
                        ? '—'
                        : formatRate(row.unit_cost_at_movement)}
                    </td>
                    <td
                      className={`text-body-sm tabular px-5 py-3 ${
                        effect === null
                          ? 'text-text-tertiary'
                          : effect.isNegative()
                            ? 'text-negative-value'
                            : 'text-text-secondary'
                      }`}
                    >
                      {effect === null ? '—' : effect.format()}
                    </td>
                    <td className="text-caption px-5 py-3 text-text-tertiary">
                      {row.reason ?? (row.source_table === 'purchases' ? 'From a purchase' : '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-caption mt-4 text-text-tertiary">
        {rows.length} {rows.length === 1 ? 'movement' : 'movements'}. Each row stores the balance
        and average that resulted from it, which is what makes a past valuation a lookup rather than
        a recalculation.
      </p>
    </main>
  );
}
