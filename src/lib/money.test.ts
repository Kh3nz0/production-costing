import { describe, expect, it } from 'vitest';
import { Money } from './money';
import {
  Decimal,
  formatCalculationAmount,
  formatCalculationRate,
  formatPercent,
  formatQuantity,
  formatRate,
  fromInteger,
  roundHalfUp,
  toDecimal,
} from './decimal';

describe('Money representation', () => {
  it('holds exact centavos', () => {
    expect(Money.parse('1234.56').toCentavos()).toBe(123456n);
    expect(Money.parse('0').toCentavos()).toBe(0n);
    expect(Money.parse('-12.34').toCentavos()).toBe(-1234n);
  });

  it('formats with a peso sign, grouping and exactly two places', () => {
    expect(Money.parse('1234.56').format()).toBe('₱1,234.56');
    expect(Money.parse('1146300').format()).toBe('₱1,146,300.00');
    expect(Money.parse('0.5').format()).toBe('₱0.50');
    expect(Money.parse('-1234.5').format()).toBe('\u2212₱1,234.50');
  });

  it('survives a sum that a float would drift on', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point.
    const total = Money.sum([Money.parse('0.1'), Money.parse('0.2')]);
    expect(total.equals(Money.parse('0.3'))).toBe(true);

    // Ten thousand centavos summed one at a time, exactly.
    const many = Array.from({ length: 10_000 }, () => Money.fromCentavos(1n));
    expect(Money.sum(many).format()).toBe('₱100.00');
  });
});

describe('rounding is half-up, not bankers', () => {
  it('rounds a half away from zero', () => {
    // Banker's rounding would give ₱0.02 here, disagreeing with a phone
    // calculator in exactly the case the owner is most likely to check.
    expect(Money.parse('0.025').format()).toBe('₱0.03');
    expect(Money.parse('0.035').format()).toBe('₱0.04');
    expect(Money.parse('2.5').toCentavos()).toBe(250n);
    expect(roundHalfUp('2.5', 0).toFixed(0)).toBe('3');
    expect(roundHalfUp('3.5', 0).toFixed(0)).toBe('4');
  });

  it('rounds a negative half away from zero too', () => {
    expect(Money.parse('-0.025').format()).toBe('\u2212₱0.03');
  });
});

describe('allocation reconciles to the total', () => {
  it('reproduces the shipping example from the calculation spec', () => {
    // ₱180.00 of shipping spread by value across ₱2,300.00 of filament and
    // ₱720.00 of switches.
    const shipping = Money.parse('180.00');
    const [filament, switches] = shipping.allocate(['2300.00', '720.00']);

    expect(filament?.format()).toBe('₱137.09');
    expect(switches?.format()).toBe('₱42.91');
    expect(Money.sum([filament!, switches!]).equals(shipping)).toBe(true);
  });

  it('gives the residual centavo to the largest line', () => {
    const [a, b, c] = Money.parse('1.00').allocate(['1', '1', '1']);
    expect([a?.format(), b?.format(), c?.format()]).toEqual(['₱0.34', '₱0.33', '₱0.33']);
    expect(Money.sum([a!, b!, c!]).format()).toBe('₱1.00');
  });

  it('always reconciles, across a spread of awkward splits', () => {
    const cases: Array<[string, string[]]> = [
      ['0.01', ['1', '1', '1']],
      ['100.00', ['1', '2', '3', '7']],
      ['9.99', ['0.333', '0.333', '0.334']],
      ['1234.57', ['17', '83', '5', '1']],
      ['180.00', ['2300.00', '720.00']],
    ];
    for (const [total, weights] of cases) {
      const amount = Money.parse(total);
      const parts = amount.allocate(weights);
      expect(Money.sum(parts).equals(amount), `${total} across ${weights.join('/')}`).toBe(true);
    }
  });

  it('refuses a split it cannot make meaningful', () => {
    expect(() => Money.parse('10').allocate([])).toThrow(/zero lines/);
    expect(() => Money.parse('10').allocate(['0', '0'])).toThrow(/sum to zero/);
    expect(() => Money.parse('10').allocate(['-1', '2'])).toThrow(/negative weight/);
  });
});

describe('the sample purchase reconciles end to end', () => {
  // The chain the Item detail screen shows, and the one the whole product's
  // credibility rests on. Figures from docs/phase8-handoff.md section 11.2.
  const linesSubtotal = Money.parse('3020.00');
  const filamentLine = Money.parse('2300.00');
  const shipping = Money.parse('180.00');

  it('allocates shipping by value', () => {
    const switchLine = Money.parse('720.00');
    expect(filamentLine.plus(switchLine).equals(linesSubtotal)).toBe(true);

    const [toFilament] = shipping.allocate([filamentLine.toJSON(), switchLine.toJSON()]);
    expect(toFilament?.format()).toBe('₱137.09');
    expect(filamentLine.plus(toFilament!).format()).toBe('₱2,437.09');
  });

  it('derives the landed unit cost to six places', () => {
    const landed = Money.parse('2437.09');
    const perGram = landed.dividedByExact('2000');
    expect(formatCalculationRate(perGram)).toBe('₱1.218545');
  });

  it('derives the new weighted average to six places', () => {
    // 300.000 g already held at ₱1.100000, plus 2,000.000 g landing at
    // ₱1.218545/g, is ₱2,767.09 across 2,300.000 g.
    const heldValue = toDecimal('300').times('1.100000');
    const arrivingValue = Money.parse('2437.09').toDecimal();
    const totalValue = heldValue.plus(arrivingValue);
    const totalQty = toDecimal('300').plus('2000');

    expect(Money.fromDecimal(totalValue).format()).toBe('₱2,767.09');
    expect(formatCalculationRate(totalValue.dividedBy(totalQty))).toBe('₱1.203083');
  });

  it('values the remaining stock at the stated figure', () => {
    const value = toDecimal('2300').times('1.203083');
    expect(Money.fromDecimal(value).format()).toBe('₱2,767.09');
  });

  it('derives the switch unit cost to six places', () => {
    // 90 pc at ₱720.00 plus ₱42.91 allocated shipping.
    const landed = Money.parse('720.00').plus(Money.parse('42.91'));
    expect(landed.format()).toBe('₱762.91');
    expect(formatCalculationRate(landed.dividedByExact('90'))).toBe('₱8.476778');
    expect(Money.fromDecimal(toDecimal('87').times('8.476778')).format()).toBe('₱737.48');
  });
});

describe('display rules', () => {
  it('shows a rate at two places from ₱1.00 up and four below', () => {
    expect(formatRate('1.203083')).toBe('₱1.20');
    expect(formatRate('8.476778')).toBe('₱8.48');
    expect(formatRate('0.05')).toBe('₱0.0500');
    expect(formatRate('0.999')).toBe('₱0.9990');
    expect(formatRate('1')).toBe('₱1.00');
  });

  it('shows a calculation row at six and four places so it adds up on screen', () => {
    // A unit cost shown at two places makes 19.32 g x ₱1.20 = ₱23.18 when the
    // true figure is ₱23.24, so "show your work" visibly fails to add up.
    expect(formatCalculationRate('1.203083')).toBe('₱1.203083');
    const amount = toDecimal('19.320').times('1.203083');
    expect(formatCalculationAmount(amount)).toBe('₱23.2436');
  });

  it('shows a quantity to at most three places with trailing zeros trimmed', () => {
    expect(formatQuantity('2300', 'g')).toBe('2,300 g');
    expect(formatQuantity('19.320', 'g')).toBe('19.32 g');
    expect(formatQuantity('0.5')).toBe('0.5');
    expect(formatQuantity('1.2345', 'mm')).toBe('1.235 mm');
  });

  it('shows a percentage from a decimal fraction at one place', () => {
    expect(formatPercent('0.05')).toBe('5.0%');
    expect(formatPercent('0.157')).toBe('15.7%');
    expect(formatPercent('0.48')).toBe('48.0%');
  });
});

describe('the float ban is enforced by the types, not only by lint', () => {
  it('parses an exact string', () => {
    expect(toDecimal('1.203083').toFixed(6)).toBe('1.203083');
    expect(toDecimal(new Decimal('2')).toFixed(0)).toBe('2');
  });

  it('refuses a value that is not a finite number', () => {
    expect(() => toDecimal('not a number')).toThrow();
    expect(() => toDecimal('Infinity')).toThrow(/finite/);
  });

  it('admits a genuine integer only through fromInteger', () => {
    expect(fromInteger(20).toFixed(0)).toBe('20');
    expect(() => fromInteger(1.5)).toThrow(/safe integer/);
    expect(() => fromInteger(Number.MAX_SAFE_INTEGER + 2)).toThrow(/safe integer/);
  });

  it('rejects an API number even when a type assertion incorrectly calls it a string', () => {
    const decoded = JSON.parse('{"rate":1.20308261}') as { rate: string };
    expect(() => toDecimal(decoded.rate)).toThrow(/exact decimal text/);
  });

  it('never divides by zero silently', () => {
    expect(() => Money.parse('10').dividedByExact('0')).toThrow(/zero/);
  });
});

describe('a negative reads the same everywhere it appears', () => {
  // The movements table puts a signed quantity in one column and a signed
  // amount in the next. A hyphen beside a minus sign looks like two different
  // kinds of negative, so every display formatter uses U+2212.
  const MINUS = '−';

  it('uses a real minus sign, never a hyphen', () => {
    expect(Money.parse('-73.11').format()).toBe(`${MINUS}₱73.11`);
    expect(formatQuantity('-60', 'g')).toBe(`${MINUS}60 g`);
    expect(formatRate('-1.5')).toBe(`${MINUS}₱1.50`);
    expect(formatPercent('-0.05')).toBe(`${MINUS}5.0%`);
    expect(formatCalculationAmount('-23.2436')).toBe(`${MINUS}₱23.2436`);

    for (const text of [
      Money.parse('-1').format(),
      formatQuantity('-1'),
      formatRate('-1'),
      formatPercent('-1'),
    ]) {
      expect(text.includes('-'), `${text} still contains a hyphen`).toBe(false);
    }
  });

  it('keeps the ASCII hyphen in the stored value', () => {
    // toJSON is a data value, not a display one: a numeric column and a CSV
    // cell both need the plain form.
    expect(Money.parse('-73.11').toJSON()).toBe('-73.11');
  });
});

describe('the two string forms are not interchangeable (F-68)', () => {
  it('formats for display and serialises for data', () => {
    const amount = Money.parse('6.00');
    // format() and toString() are for people: grouped digits and a peso sign.
    expect(amount.format()).toBe('₱6.00');
    expect(amount.toString()).toBe('₱6.00');
    // toJSON() is for anything that will be parsed again — a numeric input, a
    // CSV cell, a numeric column. A number input rejects the display form,
    // renders empty, and submits nothing.
    expect(amount.toJSON()).toBe('6.00');
    expect(Number.isNaN(globalThis.Number(amount.toJSON()))).toBe(false);
    expect(Number.isNaN(globalThis.Number(amount.format()))).toBe(true);
  });

  it('keeps an ASCII hyphen in the data form and a real minus in the display', () => {
    const owed = Money.parse('-15.00');
    expect(owed.format()).toBe('−₱15.00');
    expect(owed.toJSON()).toBe('-15.00');
  });
});
