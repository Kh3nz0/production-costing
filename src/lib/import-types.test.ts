import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  errorCsv,
  isExampleRow,
  missingDependencies,
  orderMessage,
  parseCsv,
  readTemplateFile,
  templateByCode,
  type RowError,
} from './import-types';

/**
 * S12's done-when: all thirteen templates import; the dry run writes nothing;
 * the error CSV returns the original rows plus two columns; out-of-order is
 * refused with the correct order named.
 */

describe('the thirteen templates', () => {
  it('are thirteen, ordered, and every dependency is one of them', () => {
    expect(TEMPLATES).toHaveLength(13);
    expect(new Set(TEMPLATES.map((t) => t.order)).size).toBe(13);
    for (const template of TEMPLATES) {
      for (const dependency of template.dependsOn) {
        const found = templateByCode(dependency);
        expect(found, `${template.code} depends on ${dependency}`).toBeDefined();
        // A dependency that came later in the order would be impossible to satisfy.
        expect(found!.order).toBeLessThan(template.order);
      }
    }
  });

  it('names the order to follow when a dependency is missing', () => {
    const bom = templateByCode('12-bom-lines')!;
    const missing = missingDependencies(bom, ['02-items']);
    expect(missing).toEqual(['11-products', '07-equipment', '09-labor-activities']);
    // Named in the order they have to be run in, not the order they were listed.
    expect(orderMessage(bom, missing)).toBe(
      'Import 07-equipment, then 09-labor-activities, then 11-products before 12-bom-lines',
    );
  });
});

describe('reading a file a spreadsheet produced', () => {
  it('handles quotes, escaped quotes and newlines inside a field', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('reason\r\n"Purge losses, three colours"')).toEqual([
      ['reason'],
      ['Purge losses, three colours'],
    ]);
    expect(parseCsv('reason\r\n"He said ""jammed"""')).toEqual([['reason'], ['He said "jammed"']]);
    expect(parseCsv('reason\r\n"two\nlines"')).toEqual([['reason'], ['two\nlines']]);
  });

  it('drops the byte order mark Excel writes', () => {
    // Without this the first column is named "﻿name" and every lookup misses.
    expect(readTemplateFile('﻿name,sku\r\nFilament,F-1').columns).toEqual(['name', 'sku']);
  });

  it('skips blank lines and trims every value', () => {
    const file = readTemplateFile('name,sku\r\n  Filament ,  F-1  \r\n\r\n');
    expect(file.rows).toEqual([{ name: 'Filament', sku: 'F-1' }]);
  });

  it('recognises the example row every template ships with', () => {
    expect(isExampleRow({ notes: 'EXAMPLE ROW - delete before import' })).toBe(true);
    expect(isExampleRow({ notes: 'Bought at the hardware store' })).toBe(false);
  });
});

describe('the error file is the file you uploaded', () => {
  const columns = ['name', 'base_unit'];
  const rows = [
    { name: 'PLA Basic Filament', base_unit: 'g' },
    { name: '', base_unit: 'kg' },
  ];
  const errors: RowError[] = [
    { row: 3, field: 'name', message: 'Row 3: name is required', class: 'required' },
    { row: 3, field: 'base_unit', message: "Row 3: no unit named 'kg'", class: 'reference' },
  ];

  it('returns the original columns plus exactly two', () => {
    const csv = errorCsv(columns, rows, errors);
    const header = csv.split('\r\n')[0]!;
    expect(header).toBe('﻿name,base_unit,error_field,error_message');
  });

  it('returns only the rows that failed, with their own values intact', () => {
    const lines = errorCsv(columns, rows, errors).split('\r\n');
    expect(lines).toHaveLength(2);
    // Row 3 of the file is the second data row: the header is row 1.
    expect(lines[1]).toContain(',kg,');
    expect(lines[1]).toContain('name; base_unit');
  });

  it('quotes a message containing the comma it inevitably contains', () => {
    const csv = errorCsv(
      ['name'],
      [{ name: 'x' }],
      [{ row: 2, field: 'name', message: 'Row 2: no item named, try again', class: 'reference' }],
    );
    expect(csv).toContain('"Row 2: no item named, try again"');
  });
});
