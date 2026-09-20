import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPercent, toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';
import { requireOrg } from '@/lib/org';
import {
  getChannelsWithFees,
  getPricingSnapshots,
  getProduct,
  getProductCost,
  type ChannelWithFees,
} from '@/lib/products';
import { channelTerms } from '@/lib/pricing-terms';
import { priceForChannel, priceFromMargin, priceFromMarkup } from '@/lib/pricing';
import { businessDate } from '@/lib/business-date';
import { ProductTabs } from '../product-tabs';
import { PricingForm } from './pricing-form';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const product = await getProduct(id, org.id);
  return { title: `${product?.name ?? 'Pricing'} — Pricing` };
}

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';

export default async function ProductPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ on?: string; margin?: string; discount?: string }>;
}) {
  const org = await requireOrg();
  const { id } = await params;
  const product = await getProduct(id, org.id);
  if (!product) notFound();

  const query = await searchParams;
  const on =
    query.on && /^\d{4}-\d{2}-\d{2}$/.test(query.on) ? query.on : businessDate(org.timezone);
  const [cost, channels, snapshots] = await Promise.all([
    getProductCost(product, on),
    getChannelsWithFees(org.id, on),
    getPricingSnapshots(org.id, id),
  ]);

  // The margin on screen: whatever was just typed, else the product's saved
  // target, else nothing. A percentage in the interface, a fraction underneath.
  const savedPercent =
    product.target_margin === null
      ? ''
      : toDecimal(product.target_margin).times(100).toDecimalPlaces(4).toString();
  const marginPercent = query.margin ?? savedPercent;
  const discountPercent = query.discount ?? '0';

  let margin: string | null = null;
  let marginError: string | null = null;
  if (marginPercent !== '') {
    try {
      const fraction = toDecimal(marginPercent).div(100);
      if (fraction.gte(1)) {
        marginError =
          'A margin of 100% would need an infinite price, because margin is measured against the price itself. Use a markup instead, or a margin below 100%.';
      } else {
        margin = fraction.toString();
      }
    } catch {
      marginError = 'Enter the target margin as a number of percent.';
    }
  }
  let discount = '0';
  try {
    const fraction = toDecimal(discountPercent || '0').div(100);
    if (fraction.gte(0) && fraction.lt(1)) discount = fraction.toString();
  } catch {
    discount = '0';
  }

  const fullCost = cost ? Money.fromDecimal(cost.fullExact) : null;
  const productionCost = cost ? Money.fromDecimal(cost.inventoryExact) : null;

  // F-08's trap, shown against this product's own cost rather than in the
  // abstract: the same number in two places is two prices.
  const trap =
    fullCost !== null && margin !== null
      ? {
          asMargin: priceFromMargin(fullCost, margin),
          asMarkup: priceFromMarkup(fullCost, margin),
        }
      : null;

  const priced =
    fullCost !== null && productionCost !== null && margin !== null
      ? [null, ...channels].map((channel: ChannelWithFees | null) => ({
          channel,
          result: priceForChannel(
            fullCost,
            productionCost,
            margin,
            channelTerms(channel, discount),
          ),
        }))
      : [];

  const overhead =
    cost && cost.displayOverhead !== null ? Money.fromDecimal(cost.displayOverhead) : null;

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <Link href="/products" className="text-caption text-accent-text underline">
        Products
      </Link>
      <h1 className="text-title mt-1 text-text-primary">{product.name}</h1>
      <p className="text-body mt-1 text-text-secondary">
        What to charge, and what is left after everything is taken out.
      </p>
      <ProductTabs id={id} active="pricing" />

      {cost === null || fullCost === null || productionCost === null ? (
        <p className={`${CARD} mt-6 text-body text-text-secondary`}>
          This product has no recipe yet, so there is no cost to price against.{' '}
          <Link href={`/products/${id}/recipe`} className="text-accent-text underline">
            Build the recipe first.
          </Link>
        </p>
      ) : (
        <>
          <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
            <label className="text-caption text-text-secondary">
              Target margin
              <span className="ml-2 inline-flex items-center gap-1">
                <input
                  type="number"
                  name="margin"
                  step="any"
                  min="0"
                  defaultValue={marginPercent}
                  className="h-field w-28 rounded-control border border-border-control bg-surface px-3 text-body text-text-primary"
                />
                <span className="text-body text-text-secondary">%</span>
              </span>
            </label>
            <label className="text-caption text-text-secondary">
              Planned discount
              <span className="ml-2 inline-flex items-center gap-1">
                <input
                  type="number"
                  name="discount"
                  step="any"
                  min="0"
                  defaultValue={discountPercent}
                  className="h-field w-28 rounded-control border border-border-control bg-surface px-3 text-body text-text-primary"
                />
                <span className="text-body text-text-secondary">%</span>
              </span>
            </label>
            <label className="text-caption text-text-secondary">
              Rate date
              <input
                type="date"
                name="on"
                defaultValue={on}
                className="ml-2 h-field rounded-control border border-border-control bg-surface px-3 text-body text-text-primary"
              />
            </label>
            <button
              type="submit"
              className="text-body-sm h-control-md rounded-control bg-accent px-4 font-medium text-white"
            >
              Show prices
            </button>
          </form>
          <p className="text-caption mt-2 text-text-tertiary">
            If you plan to run a discount, the price has to be higher to survive it. Leave at zero
            if not.
          </p>

          {marginError !== null ? (
            <p role="alert" className={`${CARD} mt-6 text-body text-danger`}>
              {marginError}
            </p>
          ) : null}

          <section className={`${CARD} mt-6`}>
            <h2 className="text-heading-sm text-text-primary">The cost this price is built on</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-text-secondary">Full cost with overhead</dt>
                <dd className="text-heading-md tabular-nums text-text-primary">
                  {fullCost.format()}
                </dd>
                <p className="text-caption mt-1 text-text-tertiary">
                  A price has to recover overhead, so the price is built on this.
                </p>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">Production cost per unit</dt>
                <dd className="text-heading-md tabular-nums text-text-primary">
                  {productionCost.format()}
                </dd>
                <p className="text-caption mt-1 text-text-tertiary">
                  What a sale subtracts, because overhead never becomes stock value.
                </p>
              </div>
            </dl>
            {overhead !== null ? (
              <p className="text-body-sm mt-4 text-text-secondary">
                The {overhead.format()} between them is the overhead this price is built to recover.
                It is why the contribution margin below comes out above your target.
              </p>
            ) : null}
            {cost.missing.length > 0 ? (
              <p className="text-body-sm mt-4 text-danger">
                This cost is incomplete, so every price below is lower than it should be:{' '}
                {cost.missing.join('; ')}.
              </p>
            ) : null}
          </section>

          {trap !== null && trap.asMargin.ok && trap.asMarkup.ok ? (
            <section className={`${CARD} mt-6`}>
              <h2 className="text-heading-sm text-text-primary">These are not the same thing</h2>
              <p className="text-body-sm mt-1 text-text-secondary">
                A {formatPercent(toDecimal(margin ?? '0'))} margin and a{' '}
                {formatPercent(toDecimal(margin ?? '0'))} markup are two different prices on the
                same cost.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem]">
                  <thead>
                    <tr className="border-b border-border-strong">
                      <th className={TH}>Target</th>
                      <th className={`${TH} text-right`}>Price</th>
                      <th className={`${TH} text-right`}>Profit</th>
                      <th className={`${TH} text-right`}>Margin</th>
                      <th className={`${TH} text-right`}>Markup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['Margin', trap.asMargin.value],
                        ['Markup', trap.asMarkup.value],
                      ] as const
                    ).map(([label, row]) => (
                      <tr key={label} className="border-b border-border-subtle">
                        <td className={TD}>{label}</td>
                        <td className={`${TD} text-right tabular-nums font-medium`}>
                          {row.price.format()}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>{row.profit.format()}</td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {formatPercent(row.margin)}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {formatPercent(row.markup)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-body-sm mt-3 text-text-secondary">
                {trap.asMargin.value.price.minus(trap.asMarkup.value.price).format()} apart. Margin
                is profit as a share of the price you charge; markup is profit as a share of what it
                cost you.
              </p>
            </section>
          ) : null}

          {priced.length > 0 ? (
            <section className={`${CARD} mt-6`}>
              <h2 className="text-heading-sm text-text-primary">Price by channel</h2>
              <p className="text-body-sm mt-1 text-text-secondary">
                Each channel takes a cut, so the price that reaches your target differs.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[46rem]">
                  <thead>
                    <tr className="border-b border-border-strong">
                      <th className={TH}>Channel</th>
                      <th className={`${TH} text-right`}>Fees</th>
                      <th className={`${TH} text-right`}>
                        Price for {formatPercent(toDecimal(margin ?? '0'))} margin
                      </th>
                      <th className={`${TH} text-right`}>Expected contribution margin</th>
                      <th className={`${TH} text-right`}>Loses money below</th>
                      <th className={`${TH} text-right`}>Covers overhead above</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priced.map(({ channel, result }) => (
                      <tr key={channel?.id ?? 'direct'} className="border-b border-border-subtle">
                        <td className={TD}>
                          {channel?.name ?? 'Direct'}
                          {channel !== null && channel.effectiveFrom === null ? (
                            <span className="text-caption ml-2 text-text-tertiary">
                              no fees recorded
                            </span>
                          ) : null}
                        </td>
                        {result.ok ? (
                          <>
                            <td className={`${TD} text-right tabular-nums`}>
                              {channel === null
                                ? '—'
                                : formatPercent(
                                    toDecimal(channel.commissionRate).plus(
                                      toDecimal(channel.paymentRate),
                                    ),
                                  )}
                            </td>
                            <td className={`${TD} text-right tabular-nums font-medium`}>
                              {result.value.price.format()}
                            </td>
                            <td className={`${TD} text-right tabular-nums`}>
                              {formatPercent(result.value.contributionMargin)}
                            </td>
                            <td className={`${TD} text-right tabular-nums`}>
                              {result.value.breakEvenContribution.format()}
                            </td>
                            <td className={`${TD} text-right tabular-nums`}>
                              {result.value.breakEvenWithOverhead.format()}
                            </td>
                          </>
                        ) : (
                          <td className={`${TD} text-danger`} colSpan={5}>
                            {result.reason}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-body-sm mt-4 text-text-secondary">
                <strong className="font-medium text-text-primary">
                  Expected contribution margin is higher than your target, and that is correct.
                </strong>{' '}
                Your target is set on the full cost including overhead. Contribution margin is
                measured after the cost of the goods only, because overhead is never part of what a
                unit is worth in stock. The gap between the two is the overhead this price recovers.
              </p>
              {priced[0]?.result.ok ? (
                <p className="text-body-sm mt-3 text-text-secondary">
                  Between {priced[0].result.value.breakEvenContribution.format()} and{' '}
                  {priced[0].result.value.breakEvenWithOverhead.format()} on a direct sale, a sale
                  is profitable but not self-sufficient. Selling everything in that band means a
                  busy month that still does not pay its own running costs.
                </p>
              ) : null}
            </section>
          ) : null}

          <PricingForm
            itemId={id}
            on={on}
            marginPercent={marginPercent}
            discountPercent={discountPercent}
            channels={channels}
            canSnapshot={margin !== null}
          />
        </>
      )}

      <section className={`${CARD} mt-6`}>
        <h2 className="text-heading-sm text-text-primary">Saved snapshots</h2>
        <p className="text-body-sm mt-1 text-text-secondary">
          Records today&rsquo;s cost, rates and price so you can tell a customer a figure and still
          know later what it assumed.
        </p>
        {snapshots.length === 0 ? (
          <p className="text-body-sm mt-4 text-text-tertiary">Nothing saved yet.</p>
        ) : (
          <table className="mt-4 w-full">
            <thead>
              <tr className="border-b border-border-strong">
                <th className={TH}>Taken on</th>
                <th className={TH}>Channel</th>
                <th className={`${TH} text-right`}>Cost used</th>
                <th className={`${TH} text-right`}>Price</th>
                <th className={`${TH} text-right`}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id} className="border-b border-border-subtle">
                  <td className={TD}>{snapshot.taken_at.slice(0, 10)}</td>
                  <td className={TD}>
                    {channels.find((c) => c.id === snapshot.channel_id)?.name ?? 'Direct'}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {Money.fromDecimal(toDecimal(snapshot.pricing_unit_cost)).format()}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {Money.fromCentavos(BigInt(snapshot.list_price_cents)).format()}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {formatPercent(toDecimal(snapshot.target_margin))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
