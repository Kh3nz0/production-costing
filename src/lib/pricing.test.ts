import { describe, expect, it } from 'vitest';
import { Money } from './money';
import { formatPercent } from './decimal';
import {
  MARGIN_AT_OR_ABOVE_ONE,
  fromPrice,
  marginFromMarkup,
  markupFromMargin,
  priceForChannel,
  priceFromMargin,
  priceFromMarkup,
  type ChannelTerms,
} from './pricing';

/**
 * S7's done-when, one describe per clause. The worked examples in
 * phase3-calculations.md are the fixtures: where an implementation disagrees
 * with one, the implementation is wrong until proven otherwise.
 */

function ok<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected a price, got: ${result.reason}`);
  return result.value;
}

describe('F-08, the trap: the same 40% names two prices', () => {
  const cost = Money.parse('60.00');

  it('gives ₱100.00 as a margin and ₱84.00 as a markup', () => {
    expect(ok(priceFromMargin(cost, '0.40')).price.format()).toBe('₱100.00');
    expect(ok(priceFromMarkup(cost, '0.40')).price.format()).toBe('₱84.00');
  });

  it('reports both figures for both prices, which is the whole point', () => {
    const asMargin = ok(priceFromMargin(cost, '0.40'));
    expect(asMargin.profit.format()).toBe('₱40.00');
    expect(formatPercent(asMargin.margin)).toBe('40.0%');
    expect(formatPercent(asMargin.markup)).toBe('66.7%');

    const asMarkup = ok(priceFromMarkup(cost, '0.40'));
    expect(asMarkup.profit.format()).toBe('₱24.00');
    expect(formatPercent(asMarkup.margin)).toBe('28.6%');
    expect(formatPercent(asMarkup.markup)).toBe('40.0%');
  });

  it('is ₱16.00 apart, and the conversions agree', () => {
    const gap = ok(priceFromMargin(cost, '0.40')).price.minus(
      ok(priceFromMarkup(cost, '0.40')).price,
    );
    expect(gap.format()).toBe('₱16.00');
    expect(formatPercent(marginFromMarkup('0.40'))).toBe('28.6%');
    expect(formatPercent(markupFromMargin('0.40'))).toBe('66.7%');
  });

  it('refuses a margin of 100% and above, and says why', () => {
    const at = priceFromMargin(cost, '1');
    expect(at.ok).toBe(false);
    expect(at.ok ? '' : at.reason).toBe(MARGIN_AT_OR_ABOVE_ONE);
    expect(priceFromMargin(cost, '1.5').ok).toBe(false);
    // A markup has no such ceiling: 150% markup is an ordinary price.
    expect(ok(priceFromMarkup(cost, '1.5')).price.format()).toBe('₱150.00');
  });

  it('permits a negative margin, because selling below cost is a real decision', () => {
    const below = fromPrice(cost, Money.parse('50.00'));
    expect(below.profit.format()).toBe('−₱10.00');
    expect(formatPercent(below.margin)).toBe('−20.0%');
  });
});

describe('F-09, the back-solve across three channels', () => {
  // The F-07 product: ₱92.93 full cost, ₱80.58 production cost.
  const full = Money.parse('92.93');
  const production = Money.parse('80.58');
  const shopee: ChannelTerms = { feeRate: '0.07' };

  it('reproduces ₱154.88 direct, ₱166.54 on Shopee, ₱185.05 discounted', () => {
    expect(ok(priceForChannel(full, production, '0.40', { feeRate: '0' })).price.format()).toBe(
      '₱154.88',
    );
    expect(ok(priceForChannel(full, production, '0.40', shopee)).price.format()).toBe('₱166.54');
    expect(
      ok(
        priceForChannel(full, production, '0.40', { feeRate: '0.07', discountRate: '0.10' }),
      ).price.format(),
    ).toBe('₱185.05');
  });

  it('shows 48.0% expected contribution beside the 40% target', () => {
    const shopeePrice = ok(priceForChannel(full, production, '0.40', shopee));
    expect(shopeePrice.netRevenue.format()).toBe('₱154.88');
    expect(shopeePrice.contributionProfit.format()).toBe('₱74.30');
    expect(formatPercent(shopeePrice.contributionMargin)).toBe('48.0%');
  });

  it('accounts for the gap exactly: it is the overhead the price recovers', () => {
    const priced = ok(priceForChannel(full, production, '0.40', shopee));
    // Contribution profit less the profit the target asked for is the ₱12.35 of
    // overhead between the production cost and the full cost.
    const targetProfit = priced.netRevenue.minus(full);
    expect(priced.contributionProfit.minus(targetProfit).format()).toBe('₱12.35');
    expect(full.minus(production).format()).toBe('₱12.35');
  });

  it('measures margin against net revenue, not the list price', () => {
    // With a discount planned, measuring against the list price would report a
    // margin on money that never arrives.
    const discounted = ok(
      priceForChannel(full, production, '0.40', { feeRate: '0.07', discountRate: '0.10' }),
    );
    expect(discounted.price.format()).toBe('₱185.05');
    expect(discounted.netRevenue.format()).toBe('₱154.89');
    expect(formatPercent(discounted.contributionMargin)).toBe('48.0%');
  });

  it('refuses fees at or above 100%, and a 100% discount', () => {
    expect(priceForChannel(full, production, '0.40', { feeRate: '1' }).ok).toBe(false);
    expect(
      priceForChannel(full, production, '0.40', { feeRate: '0.07', discountRate: '1' }).ok,
    ).toBe(false);
  });

  it('carries a fixed fee and a shipping subsidy into the price', () => {
    const withExtras = ok(
      priceForChannel(full, production, '0.40', {
        feeRate: '0.07',
        fixedFee: Money.parse('10.00'),
        shippingSubsidy: Money.parse('15.00'),
      }),
    );
    // (154.8833 + 25.00) / 0.93
    expect(withExtras.price.format()).toBe('₱193.42');
  });
});

describe('F-10, the two break-even prices', () => {
  const full = Money.parse('92.93');
  const production = Money.parse('80.58');

  it('shows ₱86.65 and ₱99.92 on Shopee, and they are not the same question', () => {
    const priced = ok(priceForChannel(full, production, '0.40', { feeRate: '0.07' }));
    expect(priced.breakEvenContribution.format()).toBe('₱86.65');
    expect(priced.breakEvenWithOverhead.format()).toBe('₱99.92');
  });

  it('is the target price with the margin set to zero', () => {
    const atZero = ok(priceForChannel(full, production, '0', { feeRate: '0.07' }));
    expect(atZero.price.format()).toBe('₱99.92');
  });

  it('leaves a real contribution at the overhead break-even, not zero', () => {
    // The old single figure called ₱99.92 "the price below which you lose
    // money", which is false by ₱12.35.
    const priced = ok(priceForChannel(full, production, '0', { feeRate: '0.07' }));
    expect(priced.contributionProfit.format()).toBe('₱12.35');
  });
});
