import { Money } from './money';

/**
 * The period arithmetic the dashboard and the reports share, kept out of
 * `metrics.ts` because that module is `server-only` and therefore cannot be
 * imported by a test. Same split as `item-types.ts` and `purchase-types.ts`:
 * the pure parts live where anything can reach them (F-36).
 */

export interface Period {
  from: string;
  to: string;
}

// Dates are parsed by Date rather than by pulling integers out of the string.
// D-079 bans the coercion outright — it exists so a numeric column can never
// become a float — and a date needs no exception to it.
function day(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** The calendar month containing `date`. */
export function monthOf(date: string): Period {
  const start = day(`${date.slice(0, 7)}-01`);
  // Day zero of the next month is the last day of this one.
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/**
 * Twelve months ending on `date`, inclusive of both ends. Starting on the same
 * day of the month a year earlier would count that day in two windows.
 */
export function rollingYearTo(date: string): Period {
  const end = day(date);
  const start = new Date(
    Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate() + 1),
  );
  return { from: start.toISOString().slice(0, 10), to: date };
}

/** A count of recorded sales against the registration threshold. Not tax advice. */
export const VAT_THRESHOLD = Money.parse('3000000.00');
