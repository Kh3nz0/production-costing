import { describe, expect, it } from 'vitest';
import { openingBalanceValue } from './stock-types';

/**
 * The readout that would have caught the live typo: ₱50.00 entered where ₱2.50
 * was meant, on a form whose entry cannot be corrected afterwards.
 */

describe('the opening-balance readout', () => {
  it('multiplies the quantity by the unit cost', () => {
    expect(openingBalanceValue('50', '2.50', 'pc')).toBe('50 pc × ₱2.50 = ₱125.00');
  });

  it('makes the typo look nothing like the intention', () => {
    expect(openingBalanceValue('50', '50', 'pc')).toBe('50 pc × ₱50.00 = ₱2,500.00');
  });

  it('carries the item’s own unit, and none when there is none', () => {
    expect(openingBalanceValue('19.32', '1.10', 'g')).toBe('19.32 g × ₱1.10 = ₱21.25');
    expect(openingBalanceValue('2', '3', null)).toBe('2 × ₱3.00 = ₱6.00');
  });

  it('rounds the total half-up, once, at the end', () => {
    // 3 × ₱1.115 is ₱3.345, which is ₱3.35 half-up and ₱3.34 to a banker.
    expect(openingBalanceValue('3', '1.115', 'pc')).toBe('3 pc × ₱1.115 = ₱3.35');
  });

  it('shows nothing while the form is untouched or half-typed (F-43)', () => {
    expect(openingBalanceValue('', '', 'pc')).toBeNull();
    expect(openingBalanceValue('50', '', 'pc')).toBeNull();
    expect(openingBalanceValue('', '2.50', 'pc')).toBeNull();
    expect(openingBalanceValue('  ', '2.50', 'pc')).toBeNull();
    expect(openingBalanceValue('50', '.', 'pc')).toBeNull();
    expect(openingBalanceValue('50', 'abc', 'pc')).toBeNull();
  });

  it('shows nothing for a negative on either side', () => {
    expect(openingBalanceValue('-50', '2.50', 'pc')).toBeNull();
    expect(openingBalanceValue('50', '-2.50', 'pc')).toBeNull();
  });
});
