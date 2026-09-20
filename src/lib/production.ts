import type Decimal from 'decimal.js';
import { fromInteger, roundHalfUp, toDecimal, type Numeric } from './decimal';
import { Money } from './money';

/**
 * F-11 and F-12: what a run actually cost, and what that does to finished-goods
 * stock.
 *
 * The idea the whole file turns on: **failures you expected are part of the
 * cost of doing the work, and failures beyond that are a loss that happened.**
 * The first spread across the good units. The second are reported as a
 * production loss and kept out of stock value, because stock value is what
 * something is worth on a shelf, and a unit that went in the bin is not on a
 * shelf.
 *
 * Get that line wrong and a bad night makes a good product look unsellable:
 * the F-11 run divides out at ₱127.59 a unit the naive way against ₱82.93 the
 * correct way, on units that were estimated at ₱80.58.
 */

const ZERO = fromInteger(0);

export interface RunOutcome {
  unitsStarted: number;
  expectedFailed: number;
  normalFailed: number;
  abnormalFailed: number;
  /** Total cost of the run, before any of it is called a loss. */
  actualTotalCost: Money;
  /** Exact, unrounded: the divisor the loss is measured with. */
  costPerStartedUnit: Decimal;
  /** The part of the run that bought nothing: reported, never capitalised. */
  abnormalLoss: Money;
  /** What goes into stock with the accepted units. */
  capitalisedCost: Money;
  /** Null when nothing was accepted: there is no unit to divide by. */
  costPerAcceptedUnit: Decimal | null;
  /** What the same cost would look like if the loss were ignored. */
  naiveCostPerAcceptedUnit: Decimal | null;
}

export class RunError extends RangeError {}

/**
 * `expectedFailureRate` is null when nobody has said what it is. That is not
 * zero: zero is a claim that this product should never fail, and it makes every
 * failure abnormal. Null means unknown, and the caller has to decide.
 */
export function runOutcome(
  actualTotalCost: Money,
  unitsAccepted: number,
  unitsFailed: number,
  expectedFailureRate: Numeric,
): RunOutcome {
  if (!Number.isInteger(unitsAccepted) || !Number.isInteger(unitsFailed)) {
    throw new RunError('Units are whole things: accepted and failed must be whole numbers.');
  }
  if (unitsAccepted < 0 || unitsFailed < 0) {
    throw new RunError('A run cannot have a negative number of units.');
  }
  const unitsStarted = unitsAccepted + unitsFailed;
  if (unitsStarted === 0) {
    throw new RunError('A run that started nothing cannot be completed.');
  }

  const rate = toDecimal(expectedFailureRate);
  if (rate.isNegative() || rate.gte(1)) {
    throw new RunError('An expected failure rate must be at least 0% and below 100%.');
  }

  // Half-up, like every other rounding in this system: the owner checks figures
  // on a phone calculator, and bankers' rounding is not what that does.
  const expectedFailed = roundHalfUp(fromInteger(unitsStarted).times(rate), 0).toNumber();
  const normalFailed = Math.min(unitsFailed, expectedFailed);
  const abnormalFailed = Math.max(0, unitsFailed - expectedFailed);

  const costPerStartedUnit = actualTotalCost.dividedByExact(fromInteger(unitsStarted));
  // F-11 states this edge separately, and the general formula does not produce
  // it: with nothing accepted, the cost of the failures that were *expected*
  // has nowhere to go. Spreading it over zero units is impossible, and leaving
  // it capitalised would put value into stock that has no units under it. The
  // whole run is the loss.
  const abnormalLoss =
    unitsAccepted === 0
      ? actualTotalCost
      : Money.fromDecimal(costPerStartedUnit.times(fromInteger(abnormalFailed)));
  const capitalisedCost = actualTotalCost.minus(abnormalLoss);

  return {
    unitsStarted,
    expectedFailed,
    normalFailed,
    abnormalFailed,
    actualTotalCost,
    costPerStartedUnit,
    abnormalLoss,
    capitalisedCost,
    // Nothing accepted means the whole run was a loss and there is no unit to
    // divide by. Reporting ₱0.00 there would say the units were free.
    costPerAcceptedUnit:
      unitsAccepted === 0 ? null : capitalisedCost.dividedByExact(fromInteger(unitsAccepted)),
    naiveCostPerAcceptedUnit:
      unitsAccepted === 0 ? null : actualTotalCost.dividedByExact(fromInteger(unitsAccepted)),
  };
}

/** F-12: the finished-goods average after a run is added to it. */
export function finishedGoodsAverage(
  qtyOnHand: Numeric,
  avgCost: Numeric | null,
  unitsAccepted: number,
  capitalisedCost: Money,
): { newQty: Decimal; newAvg: Decimal } {
  const qty = toDecimal(qtyOnHand);
  const newQty = qty.plus(fromInteger(unitsAccepted));
  if (newQty.lte(0)) {
    throw new RunError('There is nothing on hand to average.');
  }
  // Same rule as a purchase receipt (D-126): stock whose cost nobody has
  // established is not worth zero, so it does not dilute what this run cost.
  const priorValue = avgCost === null ? null : qty.times(toDecimal(avgCost));
  const newAvg =
    priorValue === null
      ? capitalisedCost.dividedByExact(fromInteger(unitsAccepted))
      : priorValue.plus(capitalisedCost.toDecimal()).dividedBy(newQty);
  return { newQty, newAvg };
}

/** The line the Review screen shows against the estimate. */
export function againstEstimate(
  actual: Decimal | null,
  estimate: Numeric | null,
): { difference: Decimal; fraction: Decimal } | null {
  if (actual === null || estimate === null) return null;
  const estimated = toDecimal(estimate);
  if (estimated.lte(0)) return null;
  const difference = actual.minus(estimated);
  return { difference, fraction: difference.dividedBy(estimated) };
}

export const ZERO_DECIMAL = ZERO;
