import { Money } from './money';
import { toDecimal } from './decimal';
import type { ChannelTerms } from './pricing';
import type { ChannelWithFees } from './products';

/**
 * One place that turns a stored channel into the terms the pricing maths takes,
 * because the page, the snapshot action and any later report must all agree on
 * what "Shopee at 7%" means. Commission and payment fee add up: both are taken
 * as a share of the discounted price, so the maths only ever needs their sum.
 */
export function channelTerms(
  channel: Pick<ChannelWithFees, 'commissionRate' | 'paymentRate' | 'fixedFeeCents'> | null,
  discountRate: string,
): ChannelTerms {
  if (channel === null) {
    return { feeRate: '0', discountRate };
  }
  return {
    feeRate: toDecimal(channel.commissionRate).plus(toDecimal(channel.paymentRate)).toString(),
    fixedFee: Money.fromCentavos(BigInt(channel.fixedFeeCents)),
    discountRate,
  };
}
