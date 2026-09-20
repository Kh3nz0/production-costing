import type Decimal from 'decimal.js';
import { fromInteger, toDecimal, type Numeric } from './decimal';
import { Money } from './money';

/**
 * F-08, F-09 and F-10: what to charge, and what survives the channel's cut.
 *
 * Every function here is pure and works on exact decimals. Nothing rounds
 * except where a peso amount is produced, and that goes through
 * `Money.fromDecimal`, the project's single rounding boundary.
 *
 * The one idea the whole file exists to hold on to: a price is built on the
 * FULL cost, because a price has to recover overhead, while the contribution
 * margin a sale later reports subtracts only the PRODUCTION cost, because
 * overhead is never capitalised into stock (D-008). The two figures therefore
 * differ on purpose, and the screen shows both so the difference is never
 * discovered after the fact.
 */

/**
 * D-079 bans a `number` from reaching a monetary value, and that includes the
 * literal 1 in `1 − margin`: `ONE` is a compile error, not a lint
 * warning. `fromInteger` is the one sanctioned door for a genuine integer.
 */
const ONE = fromInteger(1);
const ZERO_RATE = fromInteger(0);

export const MARGIN_AT_OR_ABOVE_ONE =
  'A margin of 100% would need an infinite price, because margin is measured against the price itself. Use a markup instead, or a margin below 100%.';

export const FEES_AT_OR_ABOVE_ONE =
  'The fees on this channel come to 100% or more of the price, so no price can reach your target.';

export const DISCOUNT_AT_OR_ABOVE_ONE = 'A discount of 100% leaves nothing to price against.';

/** Refused inputs carry the reason rather than a silent null. */
export type Priced<T> = { ok: true; value: T } | { ok: false; reason: string };

function refuse(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

/**
 * The pair, always together (F-08). Margin is profit over the price, markup is
 * profit over the cost, and the same "40%" names two prices ₱16.00 apart on a
 * ₱60.00 cost.
 */
export interface MarginAndMarkup {
  price: Money;
  profit: Money;
  margin: Decimal;
  markup: Decimal;
}

export function fromPrice(cost: Money, price: Money): MarginAndMarkup {
  const profit = price.minus(cost);
  return {
    price,
    profit,
    margin: price.isZero() ? ZERO_RATE : profit.toDecimal().dividedBy(price.toDecimal()),
    markup: cost.isZero() ? ZERO_RATE : profit.toDecimal().dividedBy(cost.toDecimal()),
  };
}

/** `price = cost / (1 − margin)`. Refused at 100% and above, where it diverges. */
export function priceFromMargin(cost: Money, margin: Numeric): Priced<MarginAndMarkup> {
  const m = toDecimal(margin);
  if (m.gte(1)) return refuse(MARGIN_AT_OR_ABOVE_ONE);
  return {
    ok: true,
    value: fromPrice(cost, Money.fromDecimal(cost.dividedByExact(ONE.minus(m)))),
  };
}

/** `price = cost × (1 + markup)`. A markup has no ceiling. */
export function priceFromMarkup(cost: Money, markup: Numeric): Priced<MarginAndMarkup> {
  const k = toDecimal(markup);
  return {
    ok: true,
    value: fromPrice(cost, Money.fromDecimal(cost.timesExact(ONE.plus(k)))),
  };
}

export function marginFromMarkup(markup: Numeric): Decimal {
  const k = toDecimal(markup);
  return k.dividedBy(ONE.plus(k));
}

export function markupFromMargin(margin: Numeric): Decimal {
  const m = toDecimal(margin);
  return m.dividedBy(ONE.minus(m));
}

/** What a channel takes, per unit sold. */
export interface ChannelTerms {
  /** Commission plus payment fee, as a fraction of the discounted price. */
  feeRate: Numeric;
  /** Fixed fee per order, and any other flat per-sale cost. */
  fixedFee?: Money;
  /** Shipping paid out less shipping charged, never below zero. */
  shippingSubsidy?: Money;
  /** A discount planned off the list price. */
  discountRate?: Numeric;
}

export interface ChannelPrice {
  /** The list price to publish. */
  price: Money;
  /** What the channel pays out after fees and the planned discount. */
  netRevenue: Money;
  /** Price less cost of goods less fees: what the sale actually contributes. */
  contributionProfit: Money;
  /** Contribution over net revenue. Higher than the target, by the overhead. */
  contributionMargin: Decimal;
  /** Below this the sale earns nothing at all. */
  breakEvenContribution: Money;
  /** Below this it earns something, but does not carry its share of the month. */
  breakEvenWithOverhead: Money;
}

function divisor(terms: ChannelTerms): Priced<Decimal> {
  const fees = toDecimal(terms.feeRate);
  const discount = toDecimal(terms.discountRate ?? '0');
  if (fees.gte(1)) return refuse(FEES_AT_OR_ABOVE_ONE);
  if (discount.gte(1)) return refuse(DISCOUNT_AT_OR_ABOVE_ONE);
  return { ok: true, value: ONE.minus(discount).times(ONE.minus(fees)) };
}

/**
 * F-09 and F-10 together, because they are the same division and separating
 * them is how the two break-evens got conflated in the first place.
 *
 * `fullCost` builds the price; `productionCost` measures what comes back. Pass
 * the same value for both only if the product genuinely carries no overhead.
 */
export function priceForChannel(
  fullCost: Money,
  productionCost: Money,
  targetMargin: Numeric,
  terms: ChannelTerms,
): Priced<ChannelPrice> {
  const m = toDecimal(targetMargin);
  if (m.gte(1)) return refuse(MARGIN_AT_OR_ABOVE_ONE);
  const d = divisor(terms);
  if (!d.ok) return d;

  const fixed = terms.fixedFee ?? Money.ZERO;
  const subsidy = terms.shippingSubsidy ?? Money.ZERO;
  const perUnitExtras = fixed.plus(subsidy).toDecimal();

  // NR = C / (1 − m), then P = (NR + K + S) / ((1 − d)(1 − f)).
  const requiredNet = fullCost.dividedByExact(ONE.minus(m));
  const price = Money.fromDecimal(requiredNet.plus(perUnitExtras).dividedBy(d.value));

  // Measured from the price actually charged, not from the exact one: what the
  // customer pays is a peso amount, and the margin has to describe that.
  const discounted = price.timesExact(ONE.minus(toDecimal(terms.discountRate ?? '0')));
  const netRevenue = Money.fromDecimal(
    discounted.times(ONE.minus(toDecimal(terms.feeRate))).minus(perUnitExtras),
  );
  const contributionProfit = netRevenue.minus(productionCost);

  return {
    ok: true,
    value: {
      price,
      netRevenue,
      contributionProfit,
      contributionMargin: netRevenue.isZero()
        ? ZERO_RATE
        : contributionProfit.toDecimal().dividedBy(netRevenue.toDecimal()),
      breakEvenContribution: Money.fromDecimal(
        productionCost.toDecimal().plus(perUnitExtras).dividedBy(d.value),
      ),
      breakEvenWithOverhead: Money.fromDecimal(
        fullCost.toDecimal().plus(perUnitExtras).dividedBy(d.value),
      ),
    },
  };
}
