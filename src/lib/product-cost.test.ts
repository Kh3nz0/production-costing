import { describe, expect, it } from 'vitest';
import { calculateProductCost, energyRatePerKwh, type CostInput } from './product-cost';

const F07: CostInput[] = [
  {
    kind: 'item',
    id: 'filament',
    name: 'Filament',
    quantity: '19.32',
    unit: 'g',
    unitCost: '1.20308261',
    source: 'Item average',
  },
  {
    kind: 'item',
    id: 'switches',
    name: 'Switches',
    quantity: '3',
    unit: 'pc',
    unitCost: '8.47677778',
    source: 'Item average',
  },
  {
    kind: 'item',
    id: 'ring',
    name: 'Key ring',
    quantity: '1',
    unit: 'pc',
    unitCost: '2.5',
    source: 'Item average',
  },
  {
    kind: 'item',
    id: 'bag',
    name: 'Plastic bag',
    quantity: '1',
    unit: 'pc',
    unitCost: '1.2',
    source: 'Item average',
  },
  {
    kind: 'machine',
    id: 'printer',
    name: 'Printer',
    hours: '0.35',
    rate: '12',
    rateDate: '2026-01-01',
    watts: '110',
    utilityRate: '12.5',
    utilityDate: '2026-01-01',
  },
  {
    kind: 'labour',
    id: 'assembly',
    name: 'Assembly',
    hours: '0.10',
    attended: true,
    rate: '150',
    rateDate: '2026-01-01',
  },
  {
    kind: 'labour',
    id: 'packing',
    name: 'Packing',
    hours: '0.03',
    attended: true,
    rate: '150',
    rateDate: '2026-01-01',
  },
];

describe('F-07 cost of one good keychain', () => {
  it('reproduces the documented component and full costs without float arithmetic', () => {
    const cost = calculateProductCost(F07, '0.05', {
      method: 'per_attended_hour',
      rate: '95',
      percent: null,
      effectiveFrom: '2026-01-01',
    });
    expect(cost.rows.map((row) => row.displayAmount?.toFixed(4))).toEqual([
      '23.2436',
      '25.4303',
      '2.5000',
      '1.2000',
      '4.2000',
      '0.4813',
      '15.0000',
      '4.5000',
    ]);
    expect(cost.rows[0]?.inputs.find((input) => input.label === 'Unit cost')?.value).toBe(
      '₱1.203083',
    );
    expect(cost.rows[4]?.inputs.find((input) => input.label === 'Rate effective from')?.value).toBe(
      '2026-01-01',
    );
    expect(cost.rows[5]?.inputs.find((input) => input.label === 'Rate effective from')?.value).toBe(
      '2026-01-01',
    );
    expect(cost.displayDirect.toFixed(4)).toBe('76.5552');
    expect(cost.displayFailure.toFixed(4)).toBe('4.0292');
    expect(cost.displayRounding.toString()).toBe('0');
    expect(cost.displayInventory.toFixed(4)).toBe('80.5844');
    expect(cost.displayOverhead?.toFixed(4)).toBe('12.3500');
    expect(cost.displayFull.toFixed(4)).toBe('92.9344');
    expect(cost.displayFullRounding.toString()).toBe('0');
    expect(cost.fullExact.toDecimalPlaces(2).toFixed(2)).toBe('92.93');
    expect(cost.missing).toEqual([]);
  });

  it('excludes and names missing inputs instead of treating them as recorded zeroes', () => {
    const lines: CostInput[] = [
      {
        kind: 'item',
        id: 'filament',
        name: 'Filament',
        quantity: '19.32',
        unit: 'g',
        unitCost: null,
        source: null,
      },
      {
        kind: 'machine',
        id: 'printer',
        name: 'Printer',
        hours: '0.35',
        rate: null,
        rateDate: null,
        watts: '110',
        utilityRate: null,
        utilityDate: null,
      },
    ];
    const cost = calculateProductCost(lines, '0.05', null);
    expect(cost.rows.every((row) => row.amount === null)).toBe(true);
    expect(cost.rows.every((row) => row.displayAmount === null)).toBe(true);
    expect(cost.missing).toEqual([
      'Filament: no unit cost recorded',
      'Printer: no equipment rate in force',
      'Printer: no electricity rate in force',
      'No overhead rule is in force',
    ]);
  });

  it('converts a Wh utility rate to the kWh consumed by a machine', () => {
    expect(energyRatePerKwh('0.0125', '1').toFixed(4)).toBe('12.5000');
    expect(energyRatePerKwh('12.5', '1000').toFixed(4)).toBe('12.5000');
  });

  it('flags an unknown expected failure rate instead of silently assuming none', () => {
    const cost = calculateProductCost(F07, null, {
      method: 'none',
      rate: null,
      percent: null,
      effectiveFrom: '2026-01-01',
    });
    expect(cost.missing).toContain('Expected failure rate is not set');
    expect(cost.failureRate).toBeNull();
  });

  it('keeps rounding separate from a small positive failure allowance', () => {
    const material: CostInput = {
      kind: 'item',
      id: 'a',
      name: 'Material',
      quantity: '1',
      unit: 'pc',
      unitCost: '1.00006',
      source: 'Item average',
    };
    const cost = calculateProductCost([material, { ...material, id: 'b' }], '0.000001', {
      method: 'none',
      rate: null,
      percent: null,
      effectiveFrom: '2026-01-01',
    });
    expect(cost.displayDirect.toFixed(4)).toBe('2.0002');
    expect(cost.displayFailure.toFixed(4)).toBe('0.0000');
    expect(cost.displayRounding.toFixed(4)).toBe('-0.0001');
    expect(cost.displayInventory.toFixed(4)).toBe('2.0001');
    expect(
      cost.displayDirect
        .plus(cost.displayFailure)
        .plus(cost.displayRounding)
        .eq(cost.displayInventory),
    ).toBe(true);
  });

  it('reveals the exact rate when a six-place rate alone would not reproduce the row', () => {
    const cost = calculateProductCost(
      [
        {
          kind: 'item',
          id: 'large',
          name: 'Large quantity',
          quantity: '200',
          unit: 'pc',
          unitCost: '1.00000049',
          source: 'Item average',
        },
      ],
      '0',
      { method: 'none', rate: null, percent: null, effectiveFrom: '2026-01-01' },
    );
    expect(cost.rows[0]!.displayAmount!.toFixed(4)).toBe('200.0001');
    expect(cost.rows[0]!.inputs).toContainEqual({ label: 'Unit cost', value: '₱1.000000' });
    expect(cost.rows[0]!.inputs).toContainEqual({
      label: 'Exact unit cost used',
      value: '₱1.00000049',
    });
  });

  it('reconciles rounded overhead with the rounded full cost', () => {
    const cost = calculateProductCost(
      [
        {
          kind: 'item',
          id: 'a',
          name: 'Material',
          quantity: '1',
          unit: 'pc',
          unitCost: '1.00006',
          source: 'Item average',
        },
      ],
      '0',
      { method: 'flat_per_unit', rate: '1.00006', percent: null, effectiveFrom: '2026-01-01' },
    );
    expect(cost.displayInventory.toFixed(4)).toBe('1.0001');
    expect(cost.displayOverhead!.toFixed(4)).toBe('1.0001');
    expect(cost.displayFullRounding.toFixed(4)).toBe('-0.0001');
    expect(cost.displayFull.toFixed(4)).toBe('2.0001');
  });
});
