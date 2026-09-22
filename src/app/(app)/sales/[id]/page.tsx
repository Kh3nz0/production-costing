import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPercent, formatQuantity, formatRate } from '@/lib/decimal';
import { Money } from '@/lib/money';
import { requireOrg } from '@/lib/org';
import { getSale } from '@/lib/runs';

export const metadata = { title: 'Sale detail' };

const CARD = 'rounded-card border border-border-strong bg-surface p-5';

function money(cents: string | null): Money | null {
  return cents === null ? null : Money.fromCentavos(BigInt(cents));
}

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const sale = await getSale(id, org.id);
  if (sale === null) notFound();

  const revenue = money(sale.revenue_cents)!;
  const cogs = money(sale.cogs_cents);
  const grossProfit = money(sale.gross_profit_cents);
  const netRevenue = money(sale.net_revenue_cents)!;
  const contribution = money(sale.contribution_profit_cents);
  const shippingCharged = money(sale.shipping_charged_cents)!;
  const shippingPaid = money(sale.shipping_cost_cents)!;
  const shippingNet = shippingCharged.minus(shippingPaid);
  const grossMargin =
    revenue.toCentavos() > 0n && grossProfit !== null
      ? formatPercent(grossProfit.toDecimal().dividedBy(revenue.toDecimal()))
      : '—';
  const contributionMargin =
    netRevenue.toCentavos() > 0n && contribution !== null
      ? formatPercent(contribution.toDecimal().dividedBy(netRevenue.toDecimal()))
      : '—';

  const resultRow = (label: string, value: string, emphasis = false) => (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-body-sm text-text-secondary">{label}</dt>
      <dd
        className={`text-body-sm tabular text-right ${emphasis ? 'font-medium text-text-primary' : 'text-text-primary'}`}
      >
        {value}
      </dd>
    </div>
  );

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <Link href="/sales" className="text-caption text-accent-text underline">
        Sales
      </Link>
      <h1 className="text-title mt-1 text-text-primary">
        {sale.reference_no ?? `Sale on ${sale.sale_date}`}
      </h1>
      <p className="text-body mt-1 text-text-secondary">
        {sale.sale_date} · {sale.channel?.name ?? 'Direct'}
        {sale.customer_name ? ` · ${sale.customer_name}` : ''}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className={CARD}>
            <h2 className="text-heading-sm text-text-primary">What was sold</h2>
            <ul className="mt-4 divide-y divide-border-subtle">
              {sale.lines.map((line) => {
                const unitPrice = money(line.unit_price_cents)!;
                const discount = money(line.line_discount_cents)!;
                const lineRevenue = Money.fromDecimal(unitPrice.timesExact(line.quantity)).minus(
                  discount,
                );
                return (
                  <li key={line.id} className="py-4 first:pt-0 last:pb-0">
                    <h3 className="text-body font-medium text-text-primary">
                      {line.item?.name ?? 'Unknown product'}
                    </h3>
                    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-caption text-text-tertiary">Quantity</dt>
                        <dd className="text-body-sm tabular text-text-primary">
                          {formatQuantity(line.quantity, line.item?.base_unit?.code)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-caption text-text-tertiary">Unit price</dt>
                        <dd className="text-body-sm tabular text-text-primary">
                          {unitPrice.format()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-caption text-text-tertiary">Discount</dt>
                        <dd className="text-body-sm tabular text-text-primary">
                          {discount.format()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-caption text-text-tertiary">Line revenue</dt>
                        <dd className="text-body-sm tabular text-text-primary">
                          {lineRevenue.format()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-caption text-text-tertiary">Unit cost at sale</dt>
                        <dd className="text-body-sm tabular text-text-primary">
                          {line.unit_cogs === null ? 'Unknown' : formatRate(line.unit_cogs)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-caption text-text-tertiary">Cost of goods sold</dt>
                        <dd className="text-body-sm tabular text-text-primary">
                          {money(line.line_cogs_cents)?.format() ?? 'Unknown'}
                        </dd>
                      </div>
                    </dl>
                    {line.production_run_id ? (
                      <Link
                        href={`/production/${line.production_run_id}`}
                        className="text-body-sm mt-3 inline-block text-accent-text underline"
                      >
                        View linked production run
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={CARD}>
            <h2 className="text-heading-sm text-text-primary">Sale record</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-body-sm">
              <div>
                <dt className="text-caption text-text-tertiary">Payment</dt>
                <dd className="text-text-primary">
                  {sale.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">Fulfilment</dt>
                <dd className="text-text-primary">
                  {sale.fulfilment_status[0]!.toUpperCase() + sale.fulfilment_status.slice(1)}
                </dd>
              </div>
            </dl>
            {sale.notes ? (
              <p className="text-body-sm mt-3 text-text-secondary">{sale.notes}</p>
            ) : null}
          </section>
        </div>

        <section className={CARD}>
          <h2 className="text-heading-sm text-text-primary">What this sale earned</h2>
          <p className="text-caption mt-1 text-text-secondary">
            Saved at the time of sale. Later cost and channel-rate changes do not rewrite it.
          </p>
          <dl className="mt-4 divide-y divide-border-subtle">
            {resultRow('Revenue', revenue.format())}
            {resultRow('Cost of goods sold', cogs?.format() ?? 'Unknown')}
            {resultRow('Gross profit', grossProfit?.format() ?? '—')}
            {resultRow('Gross margin', grossMargin)}
            {resultRow('Commission', money(sale.commission_fee_cents)!.format())}
            {resultRow('Payment fee', money(sale.payment_fee_cents)!.format())}
            {resultRow('Fixed fee', money(sale.fixed_fee_cents)!.format())}
            {resultRow('Other costs', money(sale.other_costs_cents)!.format())}
            {resultRow('Shipping result', shippingNet.isZero() ? '—' : shippingNet.format())}
            {resultRow('Net revenue', netRevenue.format(), true)}
            {resultRow('Contribution profit', contribution?.format() ?? 'Unknown', true)}
            {resultRow('Contribution margin', contributionMargin, true)}
          </dl>
          <p className="text-caption mt-3 text-text-secondary">
            You charged {shippingCharged.format()} for shipping and paid {shippingPaid.format()}.
          </p>
          {sale.cost_source === 'estimate' ? (
            <p className="text-body-sm mt-4 rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
              Estimated cost. This sale used a production estimate because costed stock was not
              available.
            </p>
          ) : cogs === null ? (
            <p className="text-body-sm mt-4 rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
              Cost unknown. Stock had no established cost when this sale was recorded.
            </p>
          ) : null}
          <p className="text-caption mt-4 text-text-tertiary">
            Contribution profit is before monthly running costs and taxes. It is not net profit.
          </p>
        </section>
      </div>
    </main>
  );
}
