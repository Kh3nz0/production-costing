import { NextResponse } from 'next/server';
import { toDecimal } from '@/lib/decimal';
import { requireOrg } from '@/lib/org';
import { businessDate } from '@/lib/business-date';
import { reportBySlug, toCsv } from '@/lib/report-types';
import { runReport } from '@/lib/reports';

/**
 * The export runs the same function the screen ran, with the same filters and
 * the same page, and writes each cell's `data` form. There is one query and one
 * set of totals; the CSV is the other rendering of it. An export that
 * recomputed its own figures is an export that can disagree with the screen.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const org = await requireOrg();
  const { slug } = await params;
  const meta = reportBySlug(slug);
  if (!meta) return new NextResponse('Not found', { status: 404 });

  const url = new URL(request.url);
  const valid = (value: string | null) =>
    value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const fromDate = valid(url.searchParams.get('from'));
  const toDate = valid(url.searchParams.get('to'));
  const pageParam = url.searchParams.get('page') ?? '1';
  // Through Decimal, not parseInt: D-079 bans the global coercions (F-71).
  const page = /^\d+$/.test(pageParam) ? Math.max(0, toDecimal(pageParam).minus(1).toNumber()) : 0;

  const result = await runReport(slug, {
    orgId: org.id,
    period: fromDate !== null && toDate !== null ? { from: fromDate, to: toDate } : null,
    page,
    asOf: businessDate(org.timezone),
  });
  if (result === null) return new NextResponse('Not found', { status: 404 });

  const rows = result.rows.map((row) => row.map((cell) => cell.data));
  if (result.totals) rows.push(result.totals.map((cell) => cell.data));
  const csv = toCsv(result.columns, rows);

  const range = fromDate !== null && toDate !== null ? `-${fromDate}-to-${toDate}` : '';
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}${range}.csv"`,
    },
  });
}
