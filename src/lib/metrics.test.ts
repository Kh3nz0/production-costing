import { describe, expect, it } from 'vitest';
import { monthOf, rollingYearTo, VAT_THRESHOLD } from './metrics-periods';

/**
 * The period helpers the dashboard and the reports both use. A card and a
 * report that disagree about what "this month" means would disagree about
 * every figure inside it.
 */

describe('the month a date falls in', () => {
  it('runs from the first to the last day', () => {
    expect(monthOf('2026-09-20')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthOf('2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(monthOf('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('gets February right in a leap year and out of one', () => {
    expect(monthOf('2028-02-10').to).toBe('2028-02-29');
    expect(monthOf('2026-02-10').to).toBe('2026-02-28');
  });
});

describe('the rolling twelve months', () => {
  it('ends on the date and starts the day after, a year earlier', () => {
    // Inclusive of both ends: 21 Sep 2025 to 20 Sep 2026 is twelve months, and
    // starting on the 20th would count that day twice across two windows.
    expect(rollingYearTo('2026-09-20')).toEqual({ from: '2025-09-21', to: '2026-09-20' });
  });

  it('crosses a year boundary', () => {
    expect(rollingYearTo('2026-01-15')).toEqual({ from: '2025-01-16', to: '2026-01-15' });
  });
});

describe('the VAT threshold', () => {
  it('is the ₱3,000,000 figure the screen quotes', () => {
    expect(VAT_THRESHOLD.format()).toBe('₱3,000,000.00');
  });
});
