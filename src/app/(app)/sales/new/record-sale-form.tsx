'use client';

import Link from 'next/link';

import { useActionState, useState } from 'react';
import { recordSale } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { formatPercent, formatQuantity, toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';
import { lineRevenue, marginsDiverge, saleResult, type SaleLine } from '@/lib/sales';
import type { ChannelWithFees } from '@/lib/products';
import type { SellableItem } from '@/lib/runs';

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const CONTROL =
  'h-field w-full rounded-control border border-border-control bg-surface px-3 text-body text-text-primary';
const TH = 'px-3 py-2 text-left text-caption font-medium text-text-secondary';

interface DraftLine {
  key: string;
  item_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
}

/** Empty, half-typed and nonsense all read as zero rather than throwing (F-43). */
function money(value: string): Money {
  if (value.trim() === '') return Money.ZERO;
  try {
    return Money.parse(value);
  } catch {
    return Money.ZERO;
  }
}

function blank(): DraftLine {
  return { key: crypto.randomUUID(), item_id: '', quantity: '1', unit_price: '', discount: '' };
}

export function RecordSaleForm({
  items,
  channels,
  today,
}: {
  items: SellableItem[];
  channels: ChannelWithFees[];
  today: string;
}) {
  const [state, action, pending] = useActionState(recordSale, {});
  const [lines, setLines] = useState<DraftLine[]>([blank()]);
  const [channelId, setChannelId] = useState('');
  const [commission, setCommission] = useState('');
  const [paymentFee, setPaymentFee] = useState('');
  // Once either fee is typed into, it stops following the channel's rate. The
  // rate is a default, and a default that overwrites what somebody entered is
  // not a default.
  const [feesEdited, setFeesEdited] = useState(false);
  const [otherCosts, setOtherCosts] = useState('');
  const [shippingCharged, setShippingCharged] = useState('');
  const [shippingPaid, setShippingPaid] = useState('');
  const [useEstimate, setUseEstimate] = useState(false);

  const channel = channels.find((c) => c.id === channelId) ?? null;

  const saleLines: SaleLine[] = lines.flatMap((line) => {
    const item = items.find((i) => i.id === line.item_id);
    if (!item || line.quantity.trim() === '') return [];
    let quantity;
    try {
      quantity = toDecimal(line.quantity);
    } catch {
      return [];
    }
    if (!quantity.gt(0)) return [];
    return [
      {
        quantity,
        unitPrice: money(line.unit_price),
        lineDiscount: money(line.discount),
        unitCogs: item.avg_unit_cost === null ? null : Money.parse(item.avg_unit_cost),
      },
    ];
  });

  // The fees a channel's rates imply, against the revenue as it stands now.
  // The first version filled these once, at the moment the channel was picked,
  // when the revenue was still zero — so a sale on Shopee showed ₱0.00 of
  // commission (F-65). A percentage of revenue has to follow the revenue.
  const revenueSoFar = Money.sum(saleLines.map(lineRevenue));
  const impliedCommission =
    channel === null
      ? null
      : Money.fromDecimal(revenueSoFar.timesExact(toDecimal(channel.commissionRate)));
  const impliedPaymentFee =
    channel === null
      ? null
      : Money.fromDecimal(revenueSoFar.timesExact(toDecimal(channel.paymentRate)));

  // toJSON, not toString: toString is format(), which produces `₱6.00`. A
  // number input rejects that, renders empty and submits nothing, so the panel
  // showed a commission the saved sale never had (F-68).
  const commissionShown =
    feesEdited || impliedCommission === null ? commission : impliedCommission.toJSON();
  const paymentFeeShown =
    feesEdited || impliedPaymentFee === null ? paymentFee : impliedPaymentFee.toJSON();

  const result = saleResult(saleLines, {
    commission: money(commissionShown),
    paymentFee: money(paymentFeeShown),
    otherCosts: money(otherCosts),
    shippingCharged: money(shippingCharged),
    shippingPaid: money(shippingPaid),
  });

  // The uncosted case the spec gives its own screen: stock exists but nothing
  // establishes what it cost, or there is no stock at all.
  const uncosted = lines.flatMap((line) => {
    const item = items.find((i) => i.id === line.item_id);
    if (!item) return [];
    const wanted = (() => {
      try {
        return toDecimal(line.quantity || '0');
      } catch {
        return toDecimal('0');
      }
    })();
    if (item.avg_unit_cost === null || toDecimal(item.qty_on_hand).lt(wanted)) return [item];
    return [];
  });

  const row = (label: string, value: string, emphasis = false) => (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-body-sm text-text-secondary">{label}</dt>
      <dd
        className={`text-body-sm tabular-nums ${emphasis ? 'font-medium text-text-primary' : 'text-text-primary'}`}
      >
        {value}
      </dd>
    </div>
  );

  return (
    <form action={action} className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="use_estimate" value={useEstimate ? 'yes' : 'no'} />

      <div className="flex flex-col gap-6">
        <section className={CARD}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" name="sale_date" type="date" defaultValue={today} required />
            <label className="text-caption text-text-secondary">
              Channel
              <select
                name="channel_id"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className={CONTROL}
              >
                <option value="">Direct</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Reference number"
              name="reference_no"
              helper="Optional. An order number from the platform."
            />
            <Field label="Customer name" name="customer_name" helper="Optional." />
          </div>
        </section>

        <section className={CARD}>
          <h2 className="text-heading-sm text-text-primary">What was sold</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className={TH}>Product</th>
                  <th className={`${TH} text-right`}>Quantity</th>
                  <th className={`${TH} text-right`}>Unit price</th>
                  <th className={`${TH} text-right`}>Discount</th>
                  <th className={`${TH} text-right`}>Line total</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const item = items.find((i) => i.id === line.item_id);
                  const total = money(line.unit_price)
                    .timesExact(toDecimal(line.quantity || '0'))
                    .minus(money(line.discount).toDecimal());
                  return (
                    <tr key={line.key} className="border-b border-border-subtle">
                      <td className="px-3 py-2">
                        <select
                          value={line.item_id}
                          onChange={(e) =>
                            setLines((all) =>
                              all.map((l) =>
                                l.key === line.key ? { ...l, item_id: e.target.value } : l,
                              ),
                            )
                          }
                          className={CONTROL}
                        >
                          <option value="">Choose</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        {item ? (
                          <span className="text-caption mt-1 block text-text-tertiary">
                            {formatQuantity(item.qty_on_hand, item.unit_code ?? undefined)} on hand
                            {item.avg_unit_cost === null ? ', no cost established' : ''}
                          </span>
                        ) : null}
                      </td>
                      {(
                        [
                          ['quantity', line.quantity],
                          ['unit_price', line.unit_price],
                          ['discount', line.discount],
                        ] as const
                      ).map(([key, value]) => (
                        <td key={key} className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={value}
                            onChange={(e) =>
                              setLines((all) =>
                                all.map((l) =>
                                  l.key === line.key ? { ...l, [key]: e.target.value } : l,
                                ),
                              )
                            }
                            className="h-field w-28 rounded-control border border-border-control bg-surface px-3 text-right text-body tabular-nums text-text-primary"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-body-sm tabular-nums">
                        {/* A line with no product chosen is not part of the
                            sale, so it must not show a total the panel above
                            does not count (F-66). */}
                        {item === undefined ? (
                          <span className="text-text-tertiary">—</span>
                        ) : (
                          <span className="text-text-primary">
                            {Money.fromDecimal(total).format()}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                            className="text-body-sm text-danger underline"
                            aria-label={`Remove line ${index + 1}`}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setLines((all) => [...all, blank()])}
            className="text-body-sm mt-4 text-accent-text underline"
          >
            Add another product
          </button>
        </section>

        <section className={CARD}>
          <h2 className="text-heading-sm text-text-primary">Costs of this sale</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Commission (₱)"
              name="commission"
              type="number"
              step="any"
              min="0"
              value={commissionShown}
              onChange={(e) => {
                setFeesEdited(true);
                setCommission(e.target.value);
              }}
              helper={
                channel
                  ? `Prefilled at ${formatPercent(toDecimal(channel.commissionRate))} of revenue from this channel's current rate. Change it if the platform charged something else.`
                  : 'What the platform took, if anything.'
              }
            />
            <Field
              label="Payment processing fee (₱)"
              name="payment_fee"
              type="number"
              step="any"
              min="0"
              value={paymentFeeShown}
              onChange={(e) => {
                setFeesEdited(true);
                setPaymentFee(e.target.value);
              }}
              helper={
                channel
                  ? `Prefilled at ${formatPercent(toDecimal(channel.paymentRate))} of revenue.`
                  : 'What the payment processor took, if anything.'
              }
            />
            <Field
              label="Other costs (₱)"
              name="other_costs"
              type="number"
              step="any"
              min="0"
              value={otherCosts}
              onChange={(e) => setOtherCosts(e.target.value)}
              helper="Anything else this specific sale cost you."
            />
            <div />
            <Field
              label="Shipping charged to customer (₱)"
              name="shipping_charged"
              type="number"
              step="any"
              min="0"
              value={shippingCharged}
              onChange={(e) => setShippingCharged(e.target.value)}
            />
            <Field
              label="Shipping you actually paid (₱)"
              name="shipping_paid"
              type="number"
              step="any"
              min="0"
              value={shippingPaid}
              onChange={(e) => setShippingPaid(e.target.value)}
              helper="If you charged less than you paid, the difference comes out of your profit."
            />
            <label className="text-caption text-text-secondary">
              Payment status
              <select name="payment_status" className={CONTROL} defaultValue="paid">
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
            <label className="text-caption text-text-secondary">
              Fulfilment status
              <select name="fulfilment_status" className={CONTROL} defaultValue="fulfilled">
                <option value="fulfilled">Fulfilled</option>
                <option value="unfulfilled">Unfulfilled</option>
              </select>
            </label>
          </div>
          <div className="mt-4">
            <Field label="Notes" name="notes" />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <section className={`${CARD} lg:sticky lg:top-6`}>
          <h2 className="text-heading-sm text-text-primary">What this sale earns</h2>
          <dl className="mt-4 divide-y divide-border-subtle">
            {row('Revenue', result.revenue.format())}
            {row('Cost of goods sold', result.cogs === null ? 'Unknown' : result.cogs.format())}
            {row('Gross profit', result.grossProfit === null ? '—' : result.grossProfit.format())}
            {row(
              'Gross margin',
              result.grossMargin === null ? '—' : formatPercent(result.grossMargin),
            )}
            {row('Commission', money(commissionShown).format())}
            {row('Payment fee', money(paymentFeeShown).format())}
            {row('Other costs', money(otherCosts).format())}
            {row(
              'Shipping result',
              result.shippingNet.isZero()
                ? '—'
                : `${result.shippingNet.format()}. You charged ${money(shippingCharged).format()} and paid ${money(shippingPaid).format()}.`,
            )}
            {row('Net revenue', result.netRevenue.format(), true)}
            {row(
              'Contribution profit',
              result.contributionProfit === null ? 'Unknown' : result.contributionProfit.format(),
              true,
            )}
            {row(
              'Contribution margin',
              result.contributionMargin === null ? '—' : formatPercent(result.contributionMargin),
              true,
            )}
          </dl>

          <p className="text-caption mt-4 text-text-tertiary">
            Contribution profit is what is left after the cost of the goods, fees, discounts and
            shipping. It is not net profit: it does not include your monthly running costs, taxes,
            or anything else you pay to keep the business going.
          </p>

          {marginsDiverge(result) ? (
            <p className="text-body-sm mt-4 rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
              Gross margin is {formatPercent(result.grossMargin!)} but contribution margin is{' '}
              {formatPercent(result.contributionMargin!)}. Fees and shipping took{' '}
              {result.saleCosts.minus(result.shippingNet).format()} of this sale.
            </p>
          ) : null}
        </section>

        {uncosted.length > 0 ? (
          <section className={CARD}>
            <h2 className="text-heading-sm text-text-primary">
              There is no costed stock for {uncosted[0]!.name}
            </h2>
            <p className="text-body-sm mt-2 text-text-secondary">
              You have no units of this product in stock, or nothing has established what they cost,
              so there is nothing to take a cost from. Recording a production run first gives this
              sale a real cost.
            </p>
            <label className="text-body-sm mt-4 flex items-start gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={useEstimate}
                onChange={(e) => setUseEstimate(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span>
                Save anyway using the estimate. The sale will use the current production cost per
                unit, which excludes overhead as a real cost of goods sold would, and be marked
                Estimated cost so it can be corrected once the run is entered.
              </span>
            </label>
          </section>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Saving…' : 'Save sale'}
          </Button>
          <Link href="/sales" className="text-body-sm text-text-secondary underline">
            Cancel
          </Link>
        </div>
        {state.error !== undefined ? (
          <p role="alert" className="text-body-sm text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
