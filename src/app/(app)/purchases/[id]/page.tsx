import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { getPurchase } from '@/lib/purchases';
import { PURCHASE_STATUS_LABEL, LANDED_COST_BASES } from '@/lib/purchase-types';
import { Money } from '@/lib/money';
import { formatCalculationRate, formatQuantity, toDecimal } from '@/lib/decimal';
import { receivePurchase } from '../../actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await getPurchase(id);
  const name = purchase?.reference_no ?? purchase?.purchase_date ?? 'Purchase';
  return { title: `${name} — Production Costing` };
}

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrg();
  const { id } = await params;
  const purchase = await getPurchase(id);
  if (purchase === null) notFound();

  const money = (c: string | null) => (c === null ? null : Money.fromCentavos(BigInt(c)));
  const extras = money(purchase.supplier_shipping_cents)!
    .plus(money(purchase.duties_cents)!)
    .plus(money(purchase.other_landed_cost_cents)!)
    .minus(money(purchase.discount_cents)!);

  const lines = purchase.lines;
  const received = purchase.status === 'received';
  const lineNet = (l: (typeof lines)[number]) =>
    Money.fromDecimal(
      toDecimal(l.unit_price_cents)
        .dividedBy(100)
        .times(l.qty_received ?? l.qty_ordered),
    ).minus(Money.fromCentavos(BigInt(l.line_discount_cents)));

  const subtotal = Money.sum(lines.map(lineNet));
  const allocatedTotal = Money.sum(
    lines.map((l) => money(l.allocated_landed_cost_cents) ?? Money.ZERO),
  );
  const baseLabel =
    LANDED_COST_BASES.find((b) => b.value === purchase.landed_cost_base)?.label ?? 'By value';

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <p className="text-caption text-text-tertiary">
        <Link href="/purchases" className="underline">
          Purchases
        </Link>
        {'  ·  '}
        {purchase.reference_no ?? purchase.purchase_date}
      </p>

      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">
            {purchase.reference_no ?? `Purchase of ${purchase.purchase_date}`}
          </h1>
          <p className="text-body mt-1 text-text-secondary">
            {purchase.supplier?.name ?? 'No supplier recorded'} · {purchase.purchase_date} ·{' '}
            {PURCHASE_STATUS_LABEL[purchase.status]}
          </p>
        </div>
        {received ? null : (
          <form action={receivePurchase}>
            <input type="hidden" name="id" value={purchase.id} />
            <button
              type="submit"
              className="text-body inline-flex h-control-lg items-center rounded-control bg-accent px-5 font-medium text-text-inverse transition-colors duration-[120ms] ease-out hover:bg-accent-hover"
            >
              Receive now
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-card border border-border-strong bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-sunken">
                {['Item', 'Quantity', 'Line total', 'Added cost', 'Landed total', 'Unit cost'].map(
                  (h) => (
                    <th key={h} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-border-strong">
                  <td className="text-body-sm px-5 py-3 text-text-primary">
                    {line.item?.name ?? '—'}
                  </td>
                  <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                    {formatQuantity(
                      line.qty_received ?? line.qty_ordered,
                      line.purchase_unit?.code,
                    )}
                  </td>
                  <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                    {lineNet(line).format()}
                  </td>
                  <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                    {money(line.allocated_landed_cost_cents)?.format() ?? '—'}
                  </td>
                  <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                    {money(line.landed_total_cents)?.format() ?? '—'}
                  </td>
                  <td className="text-body-sm tabular px-5 py-3 text-text-primary">
                    {line.receipt_unit_cost === null
                      ? '—'
                      : `${formatCalculationRate(line.receipt_unit_cost)} / ${line.item?.base_unit?.code ?? ''}`}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border-strong bg-surface-sunken">
                <th scope="row" className="text-heading-sm px-5 py-3 text-text-primary">
                  Lines subtotal
                </th>
                <td />
                <td className="text-heading-sm tabular px-5 py-3 text-text-primary">
                  {subtotal.format()}
                </td>
                <td className="text-heading-sm tabular px-5 py-3 text-text-primary">
                  {received ? allocatedTotal.format() : '—'}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-card border border-border-strong bg-surface-accent p-5">
            <p className="text-micro text-accent-text">
              {received ? 'How added costs were spread' : 'How added costs will be spread'}
            </p>
            <p className="text-value-sm tabular mt-1 text-text-primary">{extras.format()}</p>
            <p className="text-caption mt-1 text-text-secondary">
              {baseLabel.toLowerCase()}, across {lines.length}{' '}
              {lines.length === 1 ? 'line' : 'lines'}.
            </p>
            {received ? (
              <p className="text-caption mt-2 text-text-secondary">
                {allocatedTotal.equals(extras)
                  ? `Allocated ${allocatedTotal.format()}, which matches exactly.`
                  : `Allocated ${allocatedTotal.format()}, which does not match. This should not happen.`}
              </p>
            ) : (
              <p className="text-caption mt-2 text-text-secondary">
                Nothing has been added to stock yet. Receiving is what converts these quantities
                into base units and rewrites each item&rsquo;s unit cost.
              </p>
            )}
          </div>

          <div className="rounded-card border border-border-strong bg-surface p-5">
            <p className="text-micro text-text-tertiary">Rounding</p>
            <p className="text-caption mt-1 text-text-secondary">
              Each share rounds to the centavo and the remainder goes to the largest line, so the
              allocations always reconcile to the total.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
