import Decimal from 'decimal.js';

/**
 * Precision is set well above the 8 decimal places the schema stores, so that
 * an intermediate value is never the thing that loses accuracy.
 *
 * `docs/phase3-calculations.md`: "Intermediate values are never rounded.
 * Rounding happens at two moments only: when a monetary amount is stored as an
 * amount, and when a value is displayed."
 *
 * Rounding is half-up, not banker's. The owner checks figures on a phone
 * calculator, and banker's rounding disagrees with one in exactly the cases he
 * is most likely to check.
 */
Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

export { Decimal };

/**
 * Anything that can be read as an exact number.
 *
 * `number` is deliberately absent. Postgres `numeric` arrives over PostgREST as
 * a string, and coercing it to a JS float drifts at the fourth decimal while the
 * cost breakdown displays six (D-079). Keeping `number` out of this type makes
 * that mistake a compile error rather than a lint warning.
 */
export type Numeric = string | Decimal;

/** Parse an exact value. Throws rather than yielding NaN. */
export function toDecimal(value: Numeric): Decimal {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (!d.isFinite()) {
    throw new RangeError(`Not a finite number: ${String(value)}`);
  }
  return d;
}

/**
 * The one sanctioned way in from a JS `number`, for values that genuinely are
 * integers — a row count, a unit count, a page size. Refuses anything that
 * could have come from a float.
 */
export function fromInteger(value: number): Decimal {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Not a safe integer: ${value}`);
  }
  return new Decimal(value);
}

/** Half-up to `places`. Used at display boundaries, never mid-calculation. */
export function roundHalfUp(value: Numeric, places: number): Decimal {
  return toDecimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

/** Insert thousands separators into the integer part of a plain decimal string. */
function group(plain: string): string {
  const negative = plain.startsWith('-');
  const bare = negative ? plain.slice(1) : plain;
  const dot = bare.indexOf('.');
  const whole = dot === -1 ? bare : bare.slice(0, dot);
  const fraction = dot === -1 ? '' : bare.slice(dot);
  return `${negative ? '-' : ''}${whole.replace(GROUP, ',')}${fraction}`;
}

/**
 * A unit cost or rate. Two decimal places at ₱1.00 and above, four below, so
 * `₱0.0500/mm` does not collapse to `₱0.05`.
 */
export function formatRate(value: Numeric): string {
  const d = toDecimal(value);
  const places = d.abs().gte(1) ? 2 : 4;
  return `₱${group(roundHalfUp(d, places).toFixed(places))}`;
}

/**
 * A unit cost inside an expandable calculation row, where the figures have to
 * reconcile on screen. Six places for a unit cost, four for a component amount.
 */
export function formatCalculationRate(value: Numeric): string {
  return `₱${group(roundHalfUp(value, 6).toFixed(6))}`;
}

export function formatCalculationAmount(value: Numeric): string {
  return `₱${group(roundHalfUp(value, 4).toFixed(4))}`;
}

/** A quantity: up to three places, trailing zeros trimmed, never bare. */
export function formatQuantity(value: Numeric, unit?: string): string {
  const rounded = roundHalfUp(value, 3);
  const text = group(rounded.toFixed(3).replace(/\.?0+$/, ''));
  return unit === undefined ? text : `${text} ${unit}`;
}

/** A percentage, stored as a decimal fraction: `0.05` displays as `5.0%`. */
export function formatPercent(fraction: Numeric): string {
  const pct = toDecimal(fraction).times(100);
  return `${group(roundHalfUp(pct, 1).toFixed(1))}%`;
}

export { group as groupDigits };
