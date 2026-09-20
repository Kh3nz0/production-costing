/**
 * The shape a report returns, kept out of the `server-only` module so it can be
 * imported anywhere — the same split as `item-types.ts` (F-36).
 *
 * Every cell carries two strings. `text` is what the screen shows: grouped
 * digits, a peso sign, a real minus. `data` is what the CSV cell gets: a plain
 * value a spreadsheet will parse. They are the same number. Sending the display
 * form to a CSV is how a column of money arrives as a column of text, and
 * `Money.toString()` doing exactly that cost a live sale its fees (F-68).
 */
export interface Cell {
  text: string;
  data: string;
  align?: 'right';
}

export interface ReportResult {
  columns: string[];
  rows: Cell[][];
  /** A totals row, when the report has one. Same shape as any other row. */
  totals?: Cell[];
  /** True when more rows exist beyond this page. */
  hasMore: boolean;
  /** Said on screen when a figure is missing rather than zero. */
  notes?: string[];
}

export interface ReportMeta {
  slug: string;
  title: string;
  description: string;
}

export const REPORTS: ReportMeta[] = [
  {
    slug: 'product-cost-breakdown',
    title: 'Product cost breakdown',
    description: 'What each product costs to make, split by component.',
  },
  {
    slug: 'inventory-on-hand',
    title: 'Inventory on hand',
    description: 'Current quantities and values for every item.',
  },
  {
    slug: 'inventory-movements',
    title: 'Inventory movements',
    description: 'Every stock change with its source.',
  },
  {
    slug: 'inventory-valuation',
    title: 'Inventory valuation',
    description: 'What your stock was worth on a given date.',
  },
  {
    slug: 'purchase-history',
    title: 'Purchase history',
    description: 'What you bought, when, and at what unit cost.',
  },
  {
    slug: 'supplier-spending',
    title: 'Supplier spending',
    description: 'Where your money goes.',
  },
  {
    slug: 'production-history',
    title: 'Production history',
    description: 'Runs, output and actual cost per unit.',
  },
  {
    slug: 'failures-and-waste',
    title: 'Failures and waste',
    description: 'What was rejected and thrown away, and what it cost.',
  },
  {
    slug: 'sales-by-product',
    title: 'Sales and profitability by product',
    description: 'Revenue, cost of goods sold and contribution profit per product.',
  },
  {
    slug: 'profitability-by-channel',
    title: 'Profitability by channel',
    description: 'What each channel earns after its fees.',
  },
  {
    slug: 'estimated-versus-actual',
    title: 'Estimated versus actual cost',
    description: 'Where runs cost more or less than expected, and which component caused it.',
  },
  {
    slug: 'cost-changes',
    title: 'Cost changes',
    description: 'Items whose unit cost moved, and by how much.',
  },
];

export function reportBySlug(slug: string): ReportMeta | undefined {
  return REPORTS.find((report) => report.slug === slug);
}

/** RFC 4180: quote when the value contains a comma, a quote or a newline. */
export function toCsv(columns: string[], rows: string[][]): string {
  const escape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return [columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}
