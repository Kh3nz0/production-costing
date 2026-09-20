import { describe, expect, it } from 'vitest';
import { Money } from './money';
import { REPORTS, reportBySlug, toCsv, type Cell, type ReportResult } from './report-types';

/**
 * S11's done-when: all twelve render with date filters; every export's totals
 * equal the screen's; a 5,000-row report pages rather than loading whole.
 *
 * The first and third are properties of the runners and the route. This file
 * covers the second, which is a property of the shape: a report returns one set
 * of rows carrying both renderings, so the CSV is written from the same cells
 * the screen displays rather than recomputed.
 */

describe('the twelve reports', () => {
  it('are twelve, uniquely slugged, and findable', () => {
    expect(REPORTS).toHaveLength(12);
    expect(new Set(REPORTS.map((r) => r.slug)).size).toBe(12);
    expect(reportBySlug('inventory-on-hand')?.title).toBe('Inventory on hand');
    expect(reportBySlug('not-a-report')).toBeUndefined();
  });
});

describe('a CSV is the other rendering of the same rows', () => {
  const amount = Money.parse('1234.50');
  const cell = (value: Money): Cell => ({
    text: value.format(),
    data: value.toJSON(),
    align: 'right',
  });
  const result: ReportResult = {
    columns: ['Item', 'Value'],
    rows: [
      [{ text: 'PLA Basic Filament', data: 'PLA Basic Filament' }, cell(amount)],
      [{ text: 'Mechanical Switch', data: 'Mechanical Switch' }, cell(Money.parse('432.32'))],
    ],
    totals: [{ text: 'Total', data: 'Total' }, cell(Money.parse('1666.82'))],
    hasMore: false,
  };

  it('writes the data form, and the screen shows the display form', () => {
    const csv = toCsv(result.columns, [
      ...result.rows.map((row) => row.map((c) => c.data)),
      result.totals!.map((c) => c.data),
    ]);
    // The screen says ₱1,234.50; the cell says 1234.50. The same number.
    expect(result.rows[0]![1]!.text).toBe('₱1,234.50');
    expect(csv).toContain('1234.50');
    expect(csv).not.toContain('₱');
  });

  it('carries the screen’s total into the file, not a recomputed one', () => {
    const screenTotal = result.totals![1]!;
    const csv = toCsv(result.columns, [result.totals!.map((c) => c.data)]);
    expect(screenTotal.text).toBe('₱1,666.82');
    expect(csv.split('\r\n')[1]).toBe('Total,1666.82');
  });

  it('quotes a value that would otherwise break the file', () => {
    expect(toCsv(['a'], [['plain']])).toBe('a\r\nplain');
    // A reason field holds free text, and free text holds commas.
    expect(toCsv(['Reason'], [['Purge losses, three colours']])).toBe(
      'Reason\r\n"Purge losses, three colours"',
    );
    expect(toCsv(['Reason'], [['He said "jammed"']])).toBe('Reason\r\n"He said ""jammed"""');
    expect(toCsv(['Reason'], [['two\nlines']])).toBe('Reason\r\n"two\nlines"');
  });

  it('writes an empty cell for a figure that is unknown, not a zero', () => {
    // A ₱0.00 in a spreadsheet is a claim. An empty cell is the absence of one.
    const unknown: Cell = { text: 'Unknown', data: '', align: 'right' };
    expect(toCsv(['Item', 'Value'], [['Trinket', unknown.data]])).toBe('Item,Value\r\nTrinket,');
  });
});
