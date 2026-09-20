import { describe, expect, it } from 'vitest';
import { Money } from './money';
import { formatPercent } from './decimal';
import { RunError, againstEstimate, finishedGoodsAverage, runOutcome } from './production';

/**
 * S8's first done-when: the F-11 example reproduces ₱82.93 per accepted unit
 * and ₱535.89 of production loss.
 */

describe('F-11, the worked example', () => {
  const run = runOutcome(Money.parse('1531.10'), 12, 8, '0.05');

  it('splits the failures into the expected and the rest', () => {
    expect(run.unitsStarted).toBe(20);
    expect(run.expectedFailed).toBe(1);
    expect(run.normalFailed).toBe(1);
    expect(run.abnormalFailed).toBe(7);
  });

  it('produces ₱535.89 of production loss and ₱995.21 carried into stock', () => {
    expect(run.costPerStartedUnit.toFixed(4)).toBe('76.5550');
    expect(run.abnormalLoss.format()).toBe('₱535.89');
    expect(run.capitalisedCost.format()).toBe('₱995.21');
  });

  it('gives ₱82.93 per accepted unit, against ₱127.59 the naive way', () => {
    expect(Money.fromDecimal(run.costPerAcceptedUnit!).format()).toBe('₱82.93');
    expect(run.costPerAcceptedUnit!.toFixed(4)).toBe('82.9342');
    // The number the owner would reach without the split, and the reason the
    // split exists: twelve good keychains would look unsellable.
    expect(Money.fromDecimal(run.naiveCostPerAcceptedUnit!).format()).toBe('₱127.59');
  });

  it('reads as close to the estimate, with the bad night reported separately', () => {
    const versus = againstEstimate(run.costPerAcceptedUnit, '80.58')!;
    expect(Money.fromDecimal(versus.difference).format()).toBe('₱2.35');
    expect(formatPercent(versus.fraction)).toBe('2.9%');
  });
});

describe('the edges F-11 names', () => {
  it('makes the whole run a loss when nothing was accepted', () => {
    const run = runOutcome(Money.parse('1531.10'), 0, 20, '0.05');
    expect(run.abnormalFailed).toBe(19);
    // The whole run, not just the abnormal part. The general formula would
    // leave ₱76.55 capitalised — the cost of the one failure that was expected
    // — with no accepted unit underneath it to carry that value.
    expect(run.abnormalLoss.format()).toBe('₱1,531.10');
    expect(run.capitalisedCost.isZero()).toBe(true);
    // Undefined rather than zero: there is no accepted unit to divide by, and
    // ₱0.00 would say the units were free.
    expect(run.costPerAcceptedUnit).toBeNull();
  });

  it('refuses a run that started nothing', () => {
    expect(() => runOutcome(Money.parse('100.00'), 0, 0, '0.05')).toThrow(RunError);
  });

  it('makes every failure abnormal at a zero expected rate', () => {
    // Declaring 0% is a claim that this product should never fail, so every
    // failure is a loss rather than a cost of doing the work.
    const run = runOutcome(Money.parse('1000.00'), 8, 2, '0');
    expect(run.expectedFailed).toBe(0);
    expect(run.abnormalFailed).toBe(2);
    expect(run.abnormalLoss.format()).toBe('₱200.00');
    expect(run.capitalisedCost.format()).toBe('₱800.00');
  });

  it('spreads everything when failures stay within expectation', () => {
    const run = runOutcome(Money.parse('1000.00'), 19, 1, '0.05');
    expect(run.expectedFailed).toBe(1);
    expect(run.abnormalFailed).toBe(0);
    expect(run.abnormalLoss.isZero()).toBe(true);
    expect(run.capitalisedCost.format()).toBe('₱1,000.00');
  });

  it('rounds the expected failures half-up', () => {
    // 10 × 0.05 = 0.5, which is 1 half-up and 0 to a banker.
    expect(runOutcome(Money.parse('100.00'), 9, 1, '0.05').expectedFailed).toBe(1);
  });

  it('refuses fractional units and impossible rates', () => {
    expect(() => runOutcome(Money.parse('100.00'), 1.5, 0, '0.05')).toThrow(RunError);
    expect(() => runOutcome(Money.parse('100.00'), 1, 0, '1')).toThrow(RunError);
    expect(() => runOutcome(Money.parse('100.00'), 1, 0, '-0.1')).toThrow(RunError);
  });
});

describe('F-12, finished goods after the run', () => {
  it('reproduces ₱81.4829 from 5 on hand at ₱78.00', () => {
    const after = finishedGoodsAverage('5', '78.00', 12, Money.parse('995.21'));
    expect(after.newQty.toFixed(0)).toBe('17');
    expect(after.newAvg.toFixed(4)).toBe('81.4829');
  });

  it('does not dilute against stock whose cost is unknown (D-126)', () => {
    const after = finishedGoodsAverage('5', null, 12, Money.parse('995.21'));
    expect(after.newAvg.toFixed(4)).toBe('82.9342');
  });
});
