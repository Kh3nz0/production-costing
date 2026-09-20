import { Decimal, toDecimal, groupDigits, type Numeric } from './decimal';

/**
 * A stored monetary amount, held as exact integer centavos.
 *
 * `docs/phase3-calculations.md` fixes the representation: "Money amount |
 * integer minor units (centavos) | exact". Holding it as a `bigint` means a
 * total can never drift, and a sum of a thousand rows is exact by construction
 * rather than by luck.
 *
 * The class deliberately offers no operation that silently rounds. Multiplying
 * money by a rate returns a `Decimal`, because the spec allows rounding at only
 * two moments — when an amount is stored, and when it is displayed. Storing is
 * `Money.fromDecimal`, and it is the only rounding boundary in this file.
 */
export class Money {
  private constructor(private readonly centavos: bigint) {}

  static readonly ZERO = new Money(0n);

  /** From exact centavos. */
  static fromCentavos(centavos: bigint): Money {
    return new Money(centavos);
  }

  /**
   * Parse a decimal string, such as a `numeric` column or a form field.
   * More than two decimal places rounds half-up, because this is the
   * storing boundary.
   */
  static parse(value: Numeric): Money {
    return Money.fromDecimal(toDecimal(value));
  }

  /** The storing boundary: half-up to the centavo. */
  static fromDecimal(value: Decimal): Money {
    const centavos = value.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return new Money(BigInt(centavos.toFixed(0)));
  }

  static sum(amounts: readonly Money[]): Money {
    let total = 0n;
    for (const amount of amounts) {
      total += amount.centavos;
    }
    return new Money(total);
  }

  /**
   * Split `this` across `weights` so the parts sum to it exactly.
   *
   * Each share is rounded half-up, then any residual centavo is given to the
   * largest weight. The spec states the rule directly: "allocation remainders go
   * to the largest line, so allocations always reconcile to the total."
   *
   * Worked example from `docs/phase3-calculations.md`: ₱180.00 of shipping
   * across lines of ₱2,300.00 and ₱720.00 gives ₱137.09 and ₱42.91.
   */
  allocate(weights: readonly Numeric[]): Money[] {
    if (weights.length === 0) {
      throw new RangeError('Cannot allocate across zero lines');
    }
    const decimals = weights.map(toDecimal);
    if (decimals.some((w) => w.isNegative())) {
      throw new RangeError('Cannot allocate across a negative weight');
    }
    const total = decimals.reduce((a, b) => a.plus(b), new Decimal(0));
    if (total.isZero()) {
      throw new RangeError('Cannot allocate across weights that sum to zero');
    }

    const whole = this.toDecimal();
    const shares = decimals.map((w) => Money.fromDecimal(whole.times(w).dividedBy(total)));

    const residual = this.centavos - Money.sum(shares).centavos;
    if (residual === 0n) {
      return shares;
    }

    let largest = 0;
    for (let i = 1; i < decimals.length; i += 1) {
      const candidate = decimals[i];
      const incumbent = decimals[largest];
      if (candidate !== undefined && incumbent !== undefined && candidate.gt(incumbent)) {
        largest = i;
      }
    }
    const winner = shares[largest];
    if (winner === undefined) {
      throw new Error('Unreachable: allocation had no largest line');
    }
    shares[largest] = new Money(winner.centavos + residual);
    return shares;
  }

  plus(other: Money): Money {
    return new Money(this.centavos + other.centavos);
  }

  minus(other: Money): Money {
    return new Money(this.centavos - other.centavos);
  }

  negated(): Money {
    return new Money(-this.centavos);
  }

  /**
   * Multiply by a rate or quantity. Returns an unrounded `Decimal` on purpose:
   * the result is an intermediate value, and intermediates are never rounded.
   * Wrap in `Money.fromDecimal` only where the result is genuinely stored.
   */
  timesExact(factor: Numeric): Decimal {
    return this.toDecimal().times(toDecimal(factor));
  }

  /** Unrounded, for the same reason as `timesExact`. */
  dividedByExact(divisor: Numeric): Decimal {
    const d = toDecimal(divisor);
    if (d.isZero()) {
      throw new RangeError('Division by zero');
    }
    return this.toDecimal().dividedBy(d);
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.centavos < other.centavos) return -1;
    if (this.centavos > other.centavos) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.centavos === other.centavos;
  }

  isZero(): boolean {
    return this.centavos === 0n;
  }

  isNegative(): boolean {
    return this.centavos < 0n;
  }

  toCentavos(): bigint {
    return this.centavos;
  }

  toDecimal(): Decimal {
    return new Decimal(this.centavos.toString()).dividedBy(100);
  }

  /** The plain value, for a `numeric` column or an export cell. */
  toJSON(): string {
    return this.toDecimal().toFixed(2);
  }

  /** `₱1,234.56`. Always two places, always grouped. */
  format(): string {
    const negative = this.centavos < 0n;
    const magnitude = negative ? -this.centavos : this.centavos;
    const whole = magnitude / 100n;
    const fraction = magnitude % 100n;
    const text = `₱${groupDigits(whole.toString())}.${fraction.toString().padStart(2, '0')}`;
    return negative ? `-${text}` : text;
  }

  toString(): string {
    return this.format();
  }
}
