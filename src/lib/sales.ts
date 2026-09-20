import type Decimal from 'decimal.js';
import { fromInteger } from './decimal';
import { Money } from './money';

/**
 * F-13: what a sale earned, and the gap between the two figures people mean by
 * "margin".
 *
 * The naming rule the spec is firm about: `contributionProfit` is never called
 * net profit, anywhere. It excludes overhead, taxes and every operating
 * expense. Calling it net profit would make a business look solvent on a
 * figure that has not paid the rent.
 */

const ZERO = fromInteger(0);

export interface SaleLine {
  quantity: Decimal;
  unitPrice: Money;
  lineDiscount?: Money;
  /** What these units cost to produce, from the stock they came out of. */
  unitCogs: Money | null;
}

export interface SaleCosts {
  commission?: Money;
  paymentFee?: Money;
  otherCosts?: Money;
  shippingCharged?: Money;
  shippingPaid?: Money;
}

export interface SaleResult {
  revenue: Money;
  cogs: Money | null;
  grossProfit: Money | null;
  grossMargin: Decimal | null;
  saleCosts: Money;
  /** Negative is a subsidy: you charged less for postage than you paid. */
  shippingNet: Money;
  netRevenue: Money;
  contributionProfit: Money | null;
  contributionMargin: Decimal | null;
}

export function lineRevenue(line: SaleLine): Money {
  return Money.fromDecimal(line.unitPrice.timesExact(line.quantity)).minus(
    line.lineDiscount ?? Money.ZERO,
  );
}

export function lineCogs(line: SaleLine): Money | null {
  return line.unitCogs === null ? null : Money.fromDecimal(line.unitCogs.timesExact(line.quantity));
}

/** The default a fee field is prefilled with, before anyone overrides it. */
export function feeFromRate(revenue: Money, rate: Decimal | string): Money {
  return Money.fromDecimal(revenue.timesExact(rate));
}

export function saleResult(lines: SaleLine[], costs: SaleCosts): SaleResult {
  const revenue = Money.sum(lines.map(lineRevenue));

  // A single uncosted line makes the whole sale's cost unknown rather than
  // smaller. Summing what is known and calling it the total would understate
  // the cost of goods and overstate every profit below it (D-119).
  const costed = lines.map(lineCogs);
  const cogs = costed.some((amount) => amount === null) ? null : Money.sum(costed as Money[]);

  const commission = costs.commission ?? Money.ZERO;
  const paymentFee = costs.paymentFee ?? Money.ZERO;
  const otherCosts = costs.otherCosts ?? Money.ZERO;
  const saleCosts = commission.plus(paymentFee).plus(otherCosts);
  const shippingNet = (costs.shippingCharged ?? Money.ZERO).minus(costs.shippingPaid ?? Money.ZERO);

  const netRevenue = revenue.minus(saleCosts).plus(shippingNet);
  const grossProfit = cogs === null ? null : revenue.minus(cogs);
  const contributionProfit = cogs === null ? null : netRevenue.minus(cogs);

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin:
      grossProfit === null || revenue.isZero()
        ? null
        : grossProfit.toDecimal().dividedBy(revenue.toDecimal()),
    saleCosts,
    shippingNet,
    netRevenue,
    contributionProfit,
    // Measured against what actually reached you, not against the list price.
    contributionMargin:
      contributionProfit === null || netRevenue.isZero()
        ? null
        : contributionProfit.toDecimal().dividedBy(netRevenue.toDecimal()),
  };
}

/**
 * The spec shows the comparison in words when the two margins diverge by more
 * than ten points, because that gap is the entire lesson of F-13: a product
 * that looks like 32% returns 15.7% once fees and a shipping subsidy are
 * counted.
 */
export function marginsDiverge(result: SaleResult): boolean {
  if (result.grossMargin === null || result.contributionMargin === null) return false;
  return result.grossMargin.minus(result.contributionMargin).abs().gt(fromInteger(1).dividedBy(10));
}

export const NO_COGS = ZERO;
