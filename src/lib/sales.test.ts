import { describe, expect, it } from 'vitest';
import { Money } from './money';
import { formatPercent, toDecimal } from './decimal';
import { feeFromRate, marginsDiverge, saleResult, type SaleLine } from './sales';

/**
 * S9's first done-when: the F-13 example reproduces ₱15.12 and 15.7%.
 */

const KEYCHAIN: SaleLine = {
  quantity: toDecimal('1'),
  unitPrice: Money.parse('120.00'),
  unitCogs: Money.parse('81.48'),
};

describe('F-13, the worked example', () => {
  const result = saleResult([KEYCHAIN], {
    commission: feeFromRate(Money.parse('120.00'), toDecimal('0.05')),
    paymentFee: feeFromRate(Money.parse('120.00'), toDecimal('0.02')),
    shippingCharged: Money.parse('50.00'),
    shippingPaid: Money.parse('65.00'),
  });

  it('reads 32.1% gross before anything is taken out', () => {
    expect(result.revenue.format()).toBe('₱120.00');
    expect(result.cogs!.format()).toBe('₱81.48');
    expect(result.grossProfit!.format()).toBe('₱38.52');
    expect(formatPercent(result.grossMargin!)).toBe('32.1%');
  });

  it('takes ₱8.40 of fees and a ₱15.00 shipping subsidy', () => {
    expect(result.saleCosts.format()).toBe('₱8.40');
    expect(result.shippingNet.format()).toBe('−₱15.00');
    expect(result.netRevenue.format()).toBe('₱96.60');
  });

  it('returns ₱15.12 and 15.7%, not the 32.1% it looked like', () => {
    expect(result.contributionProfit!.format()).toBe('₱15.12');
    expect(formatPercent(result.contributionMargin!)).toBe('15.7%');
    // Sixteen points apart, which is the whole reason both are shown.
    expect(marginsDiverge(result)).toBe(true);
  });
});

describe('what a sale does with the awkward cases', () => {
  it('reports a surplus when postage was charged above cost', () => {
    const result = saleResult([KEYCHAIN], {
      shippingCharged: Money.parse('80.00'),
      shippingPaid: Money.parse('65.00'),
    });
    expect(result.shippingNet.format()).toBe('₱15.00');
    expect(result.netRevenue.format()).toBe('₱135.00');
  });

  it('leaves the whole cost unknown when one line is uncosted', () => {
    const result = saleResult([KEYCHAIN, { ...KEYCHAIN, unitCogs: null }], {});
    // Not ₱81.48: summing the known half and calling it the total would
    // understate the cost and overstate every profit under it (D-119).
    expect(result.cogs).toBeNull();
    expect(result.contributionProfit).toBeNull();
    expect(result.contributionMargin).toBeNull();
    // Revenue is still known, because nothing about it is in doubt.
    expect(result.revenue.format()).toBe('₱240.00');
  });

  it('applies a line discount before anything else', () => {
    const result = saleResult(
      [{ ...KEYCHAIN, quantity: toDecimal('3'), lineDiscount: Money.parse('30.00') }],
      {},
    );
    expect(result.revenue.format()).toBe('₱330.00');
    expect(result.cogs!.format()).toBe('₱244.44');
  });

  it('prefills a fee from the channel rate, as an amount', () => {
    // The rate is a default that fills the field; the amount is what is
    // stored, so a later rate change cannot rewrite this sale.
    expect(feeFromRate(Money.parse('167.11'), toDecimal('0.07')).format()).toBe('₱11.70');
  });

  it('does not flag a divergence that is only a few points', () => {
    const result = saleResult([KEYCHAIN], { commission: Money.parse('2.00') });
    expect(marginsDiverge(result)).toBe(false);
  });
});
