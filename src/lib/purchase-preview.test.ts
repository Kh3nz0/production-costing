import { describe, expect, it } from 'vitest';
import { baseUnavailableReason, previewAllocation, type PreviewLine } from './purchase-types';

/**
 * The preview the New purchase screen shows before anything is saved. It must
 * reproduce F-01 exactly, because a preview that disagrees with what gets saved
 * is worse than no preview at all.
 */

const WORKED_EXAMPLE: PreviewLine[] = [
  {
    key: 'a',
    label: 'PLA Basic Filament',
    qty: '2',
    unitPrice: '1150.00',
    dimension: 'count',
    dimensionLabel: 'spools',
    factorToBase: '1000',
    baseUnitCode: 'g',
  },
  {
    key: 'b',
    label: 'Mechanical Switch',
    qty: '1',
    unitPrice: '720.00',
    dimension: 'count',
    dimensionLabel: 'packs',
    factorToBase: '90',
    baseUnitCode: 'pc',
  },
];

describe('the preview reproduces F-01', () => {
  const preview = previewAllocation('value', { shipping: '180.00' }, WORKED_EXAMPLE);

  it('shows the line nets and the subtotal', () => {
    expect(preview.rows[0]?.lineNet.format()).toBe('₱2,300.00');
    expect(preview.rows[1]?.lineNet.format()).toBe('₱720.00');
    expect(preview.linesSubtotal.format()).toBe('₱3,020.00');
  });

  it('allocates ₱137.09 and ₱42.91', () => {
    expect(preview.rows[0]?.allocated.format()).toBe('₱137.09');
    expect(preview.rows[1]?.allocated.format()).toBe('₱42.91');
  });

  it('reconciles to the extras exactly', () => {
    expect(preview.extras.format()).toBe('₱180.00');
    expect(preview.allocatedTotal.format()).toBe('₱180.00');
    expect(preview.reconciles).toBe(true);
  });

  it('lands the lines and derives the per-unit cost to six places', () => {
    expect(preview.rows[0]?.landedTotal.format()).toBe('₱2,437.09');
    expect(preview.rows[1]?.landedTotal.format()).toBe('₱762.91');
    expect(preview.rows[0]?.unitCost).toBe('1.218545');
    expect(preview.rows[1]?.unitCost).toBe('8.476778');
  });
});

describe('extras are the sum of four fields, one of them negative', () => {
  it('nets the purchase discount off', () => {
    const preview = previewAllocation(
      'value',
      { shipping: '180.00', duties: '20.00', other: '5.00', discount: '25.00' },
      WORKED_EXAMPLE,
    );
    expect(preview.extras.format()).toBe('₱180.00');
    expect(preview.reconciles).toBe(true);
  });
});

describe('a base that cannot be used says so in the spec words', () => {
  it('refuses quantity when the lines mix dimensions', () => {
    const mixed: PreviewLine[] = [
      { ...WORKED_EXAMPLE[0]!, dimension: 'mass', dimensionLabel: 'grams', qty: '800' },
      { ...WORKED_EXAMPLE[1]!, dimension: 'count', dimensionLabel: 'pieces', qty: '90' },
    ];
    expect(baseUnavailableReason('quantity', mixed)).toBe(
      'Allocate by quantity is unavailable because this purchase mixes grams and pieces.',
    );
    expect(previewAllocation('quantity', { shipping: '180.00' }, mixed).reconciles).toBe(false);
  });

  it('allows quantity when every line shares a dimension', () => {
    expect(baseUnavailableReason('quantity', WORKED_EXAMPLE)).toBeNull();
    const preview = previewAllocation('quantity', { shipping: '300.00' }, WORKED_EXAMPLE);
    // 2 spools against 1 pack, so two thirds and one third.
    expect(preview.rows[0]?.allocated.format()).toBe('₱200.00');
    expect(preview.rows[1]?.allocated.format()).toBe('₱100.00');
    expect(preview.reconciles).toBe(true);
  });

  it('refuses weight when a line has none', () => {
    expect(baseUnavailableReason('weight', WORKED_EXAMPLE)).toBe(
      'Allocate by weight is unavailable because at least one line has no weight.',
    );
  });

  it('says nothing about value, which is always valid', () => {
    expect(baseUnavailableReason('value', WORKED_EXAMPLE)).toBeNull();
  });
});

describe('the preview does not guess', () => {
  it('shows no unit cost when the factor is unknown', () => {
    const preview = previewAllocation('value', { shipping: '10.00' }, [
      { key: 'x', label: 'Unknown', qty: '1', unitPrice: '100.00', factorToBase: null },
    ]);
    expect(preview.rows[0]?.unitCost).toBeNull();
  });

  it('allocates nothing rather than dividing by zero', () => {
    const preview = previewAllocation('value', { shipping: '10.00' }, [
      { key: 'x', label: 'Free', qty: '1', unitPrice: '0' },
      { key: 'y', label: 'Also free', qty: '1', unitPrice: '0' },
    ]);
    expect(preview.allocatedTotal.format()).toBe('₱0.00');
    expect(preview.reconciles).toBe(false);
  });
});

describe('an untouched form is not an error', () => {
  // The state the New purchase screen is in the moment it renders. Every field
  // is an empty string, which `?? '0'` does not catch, and Money.parse('')
  // threw. This is the most likely input the preview will ever receive.
  it('survives every field being empty', () => {
    const preview = previewAllocation(
      'value',
      { shipping: '', duties: '', other: '', discount: '' },
      [{ key: 'a', label: 'Nothing yet', qty: '', unitPrice: '' }],
    );
    expect(preview.extras.format()).toBe('₱0.00');
    expect(preview.linesSubtotal.format()).toBe('₱0.00');
    expect(preview.rows[0]?.allocated.format()).toBe('₱0.00');
    expect(preview.rows[0]?.unitCost).toBeNull();
    // Nothing to spread and nothing mis-spread, so it does reconcile. The
    // screen shows the "add a line" prompt in this state rather than a total.
    expect(preview.reconciles).toBe(true);
  });

  it('survives no lines at all', () => {
    const preview = previewAllocation('value', { shipping: '180.00' }, []);
    expect(preview.rows).toEqual([]);
    expect(preview.extras.format()).toBe('₱180.00');
    expect(preview.reconciles).toBe(false);
  });

  it('survives a partly filled line', () => {
    const preview = previewAllocation('value', { shipping: '50.00' }, [
      { key: 'a', label: 'Half typed', qty: '2', unitPrice: '', factorToBase: '1000' },
    ]);
    expect(preview.rows[0]?.lineNet.format()).toBe('₱0.00');
    expect(preview.allocatedTotal.format()).toBe('₱0.00');
  });
});
