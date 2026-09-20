import { expect, it } from 'vitest';
import { businessDate } from './business-date';

it('uses the Manila business date across the UTC midnight boundary', () => {
  const instant = new Date('2026-09-20T16:30:00Z');
  expect(businessDate('Asia/Manila', instant)).toBe('2026-09-21');
  expect(businessDate('UTC', instant)).toBe('2026-09-20');
});
