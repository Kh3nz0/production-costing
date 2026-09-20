import { requireOrg } from '@/lib/org';
import { valuationAsOf } from '@/lib/stock';
import { itemTypeLabel, type ItemType } from '@/lib/item-types';
import { Money } from '@/lib/money';
import { formatQuantity, formatRate, toDecimal } from '@/lib/decimal';
import { InventoryHeader, InventoryTabs } from '@/components/inventory-tabs';

export const metadata = { title: 'Inventory valuation' };

export default async function ValuationPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>;
}) {
  const org = await requireOrg();
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const asOfDate = params.as_of ?? today;

  const { rows, error } = await valuationAsOf(org.id, `${asOfDate}T23:59:59.999Z`);

  // Only what was actually held. `quantity` is numeric(20,6) and arrives as
  // '0.000000', so comparing it to the string '0' never matched — the page
  // listed every item at zero and then reported them all as uncosted.
  const held = rows.filter((r) => toDecimal(r.quantity ?? '0').gt(0));

  const byType = new Map<ItemType, typeof rows>();
  for (const row of held) {
    const list = byType.get(row.item_type) ?? [];
    list.push(row);
    byType.set(row.item_type, list);
  }

  const valueOf = (list: typeof rows): Money =>
    Money.sum(
      list.map((r) =>
        r.value_cents === null ? Money.ZERO : Money.fromCentavos(BigInt(r.value_cents)),
      ),
    );

  const total = valueOf(held);
  const uncosted = held.filter((r) => r.value_cents === null).length;

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <InventoryHeader />
      <InventoryTabs current="/inventory/valuation" />

      <h2 className="text-heading mt-6 text-text-primary">Inventory valuation</h2>

      <form action="/inventory/valuation" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-text-secondary">As of</span>
          <input
            type="date"
            name="as_of"
            defaultValue={asOfDate}
            className="h-field rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
          />
          <span className="text-caption text-text-tertiary">
            Shows what your stock was worth on that date, using the costs that applied then.
          </span>
        </label>
        <button
          type="submit"
          className="text-body h-control-md rounded-control bg-surface-sunken px-4 text-text-primary transition-colors duration-fast hover:bg-border-strong"
        >
          Show
        </button>
      </form>

      {error !== null ? (
        <p role="alert" className="text-body mt-6 text-danger">
          Could not value your stock. {error}
        </p>
      ) : held.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">Nothing on hand on {asOfDate}</p>
          <p className="text-body mt-1 text-text-secondary">
            Either there was no stock then, or nothing had been recorded yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="bg-surface-sunken">
                {['Item', 'Quantity', 'Unit cost', 'Value'].map((h) => (
                  <th key={h} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...byType.entries()].map(([type, list]) => (
                <>
                  <tr
                    key={`${type}-head`}
                    className="border-t border-border-strong bg-surface-sunken"
                  >
                    <th
                      scope="colgroup"
                      colSpan={3}
                      className="text-micro px-5 py-2 text-text-tertiary"
                    >
                      {itemTypeLabel(type)}
                    </th>
                    <td className="text-caption tabular px-5 py-2 text-text-secondary">
                      {valueOf(list).format()}
                    </td>
                  </tr>
                  {list.map((row) => (
                    <tr key={row.item_id} className="border-t border-border-strong">
                      <td className="text-body-sm px-5 py-3 text-text-primary">{row.item_name}</td>
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {formatQuantity(row.quantity, row.unit_code)}
                      </td>
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {row.unit_cost === null ? '—' : formatRate(row.unit_cost)}
                      </td>
                      <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                        {row.value_cents === null
                          ? '—'
                          : Money.fromCentavos(BigInt(row.value_cents)).format()}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
              <tr className="border-t border-border-strong bg-surface-sunken">
                <th scope="row" colSpan={3} className="text-heading-sm px-5 py-3 text-text-primary">
                  Total
                </th>
                <td className="text-heading-sm tabular px-5 py-3 text-text-primary">
                  {total.format()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-caption mt-4 max-w-[68ch] text-text-tertiary">
        Each figure comes from the last movement at or before {asOfDate}, and the balance that
        movement recorded. A purchase entered afterwards cannot change what this date was worth.
        {uncosted > 0
          ? ` ${uncosted} ${uncosted === 1 ? 'item has' : 'items have'} no established cost, so ${uncosted === 1 ? 'it contributes' : 'they contribute'} nothing to the total rather than a guess.`
          : ''}
      </p>
    </main>
  );
}
