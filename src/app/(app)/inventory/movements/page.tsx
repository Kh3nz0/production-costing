import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listMovements } from '@/lib/stock';
import { MOVEMENT_LABEL, movementLabel, type MovementType } from '@/lib/stock-types';
import { Money } from '@/lib/money';
import { formatQuantity, formatRate, toDecimal } from '@/lib/decimal';
import { InventoryHeader, InventoryTabs } from '@/components/inventory-tabs';

export const metadata = { title: 'Inventory movements' };

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

  // Both widths read the same prepared values, so a card cannot disagree with
  // its table row about a movement's resulting balance or value effect.
  const displayRows = rows.map((row) => {
    const unit = row.item?.base_unit?.code;
    const effect =
      row.cost_effect_cents === null ? null : Money.fromCentavos(BigInt(row.cost_effect_cents));
    return {
      id: row.id,
      date: row.occurred_at.slice(0, 10),
      item: row.item?.name ?? '—',
      type: movementLabel(row.movement_type),
      change: `${signed(row.quantity_change)} ${unit ?? ''}`.trim(),
      balance: formatQuantity(row.resulting_qty, unit),
      unitCost: row.unit_cost_at_movement === null ? '—' : formatRate(row.unit_cost_at_movement),
      effect: effect === null ? '—' : effect.format(),
      effectTone:
        effect === null
          ? 'text-text-tertiary'
          : effect.isNegative()
            ? 'text-negative-value'
            : 'text-text-secondary',
      reason: row.reason ?? (row.source_table === 'purchases' ? 'From a purchase' : '—'),
    };
  });

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
        <>
          <ul className="mt-6 divide-y divide-border-strong overflow-hidden rounded-card border border-border-strong bg-surface lg:hidden">
            {displayRows.map((row) => (
              <li key={row.id} className="p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-body font-medium text-text-primary">
                    {row.item}
                  </p>
                  <p className="shrink-0 text-body-sm tabular text-text-primary">{row.change}</p>
                </div>
                <p className="text-caption mt-1 text-text-secondary">
                  {row.date} · {row.type}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-caption text-text-tertiary">Balance after</dt>
                    <dd className="text-body-sm tabular text-text-primary">{row.balance}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-tertiary">Unit cost</dt>
                    <dd className="text-body-sm tabular text-text-primary">{row.unitCost}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-tertiary">Value effect</dt>
                    <dd className={`text-body-sm tabular ${row.effectTone}`}>{row.effect}</dd>
                  </div>
                </dl>
                {row.reason !== '—' ? (
                  <p className="text-caption mt-3 text-text-secondary">Why: {row.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <div
            role="region"
            aria-label="Inventory movements table"
            tabIndex={0}
            className="mt-6 hidden overflow-x-auto rounded-card border border-border-strong bg-surface lg:block"
          >
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
                {displayRows.map((row) => {
                  return (
                    <tr key={row.id} className="border-t border-border-strong">
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {row.date}
                      </td>
                      <td className="text-body-sm px-5 py-3 text-text-primary">{row.item}</td>
                      <td className="text-body-sm px-5 py-3 text-text-secondary">{row.type}</td>
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {row.change}
                      </td>
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {row.balance}
                      </td>
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {row.unitCost}
                      </td>
                      <td className={`text-body-sm tabular px-5 py-3 ${row.effectTone}`}>
                        {row.effect}
                      </td>
                      <td className="text-caption px-5 py-3 text-text-tertiary">{row.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-caption mt-4 text-text-tertiary">
        {rows.length} {rows.length === 1 ? 'movement' : 'movements'}. Each row stores the balance
        and average that resulted from it, which is what makes a past valuation a lookup rather than
        a recalculation.
      </p>
    </main>
  );
}
