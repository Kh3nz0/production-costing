import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toDecimal } from '@/lib/decimal';
import { requireOrg } from '@/lib/org';
import { businessDate } from '@/lib/business-date';
import { reportBySlug } from '@/lib/report-types';
import { PAGE_SIZE, runReport } from '@/lib/reports';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${reportBySlug(slug)?.title ?? 'Report'} — Production Costing` };
}

const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';
const DATE =
  'h-field rounded-control border border-border-control bg-surface px-3 text-body text-text-primary';

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const org = await requireOrg();
  const { slug } = await params;
  const meta = reportBySlug(slug);
  if (!meta) notFound();

  const query = await searchParams;
  const valid = (value: string | undefined) =>
    value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const fromDate = valid(query.from);
  const toDate = valid(query.to);
  const period = fromDate !== null && toDate !== null ? { from: fromDate, to: toDate } : null;
  // Pages are counted from zero internally and shown from one.
  const page = /^\d+$/.test(query.page ?? '')
    ? Math.max(0, toDecimal(query.page!).minus(1).toNumber())
    : 0;

  const result = await runReport(slug, {
    orgId: org.id,
    period,
    page,
    asOf: businessDate(org.timezone),
  });
  if (result === null) notFound();

  const link = (target: number) => {
    const parts = new URLSearchParams();
    if (fromDate) parts.set('from', fromDate);
    if (toDate) parts.set('to', toDate);
    parts.set('page', String(target + 1));
    return `/reports/${slug}?${parts.toString()}`;
  };
  const exportHref = (() => {
    const parts = new URLSearchParams();
    if (fromDate) parts.set('from', fromDate);
    if (toDate) parts.set('to', toDate);
    parts.set('page', String(page + 1));
    return `/reports/${slug}/export?${parts.toString()}`;
  })();

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <Link href="/reports" className="text-caption text-accent-text underline">
        Reports
      </Link>
      <h1 className="text-title mt-1 text-text-primary">{meta.title}</h1>
      <p className="text-body mt-1 text-text-secondary">{meta.description}</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-caption text-text-secondary">
          From
          <input type="date" name="from" defaultValue={fromDate ?? ''} className={`ml-2 ${DATE}`} />
        </label>
        <label className="text-caption text-text-secondary">
          To
          <input type="date" name="to" defaultValue={toDate ?? ''} className={`ml-2 ${DATE}`} />
        </label>
        <button
          type="submit"
          className="text-body-sm h-control-md rounded-control bg-accent px-4 font-medium text-white"
        >
          Apply
        </button>
        <Link
          href={`/reports/${slug}` as `/reports/${string}`}
          className="text-body-sm h-control-md inline-flex items-center rounded-control border border-border-control px-4 text-text-primary"
        >
          Clear
        </Link>
        <a
          href={exportHref}
          className="text-body-sm h-control-md inline-flex items-center rounded-control border border-border-control px-4 text-text-primary"
        >
          Export CSV
        </a>
      </form>
      <p className="text-caption mt-2 text-text-tertiary">
        The CSV contains the same rows, filters and totals as the screen.
      </p>

      {result.notes?.map((note) => (
        <p key={note} className="text-body-sm mt-4 text-text-secondary">
          {note}
        </p>
      ))}

      {result.rows.length === 0 ? (
        <p className="text-body mt-6 rounded-card border border-border-strong bg-surface p-6 text-text-secondary">
          Nothing to show{period === null ? '' : ' in that date range'}.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-strong">
                {result.columns.map((column, index) => (
                  <th
                    key={column}
                    className={`${TH} ${result.rows[0]?.[index]?.align === 'right' ? 'text-right' : ''}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border-subtle">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`${TD} ${cell.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {result.totals ? (
              <tfoot>
                <tr className="border-t border-border-strong">
                  {result.totals.map((cell, index) => (
                    <td
                      key={index}
                      className={`${TD} font-medium ${cell.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}

      {(page > 0 || result.hasMore) && (
        <div className="mt-4 flex items-center gap-3">
          {page > 0 ? (
            <Link
              // Built at runtime from a slug already checked against REPORTS,
              // which is what typed routes cannot see.
              href={link(page - 1) as `/reports/${string}`}
              className="text-body-sm text-accent-text underline"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-body-sm text-text-secondary">
            Page {page + 1}
            {result.rows.length > 0 ? `, ${result.rows.length} rows` : ''}
          </span>
          {result.hasMore ? (
            <Link
              href={link(page + 1) as `/reports/${string}`}
              className="text-body-sm text-accent-text underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      )}
      <p className="text-caption mt-2 text-text-tertiary">
        Rows are read {PAGE_SIZE} at a time. A report of five thousand rows pages rather than
        loading whole.
      </p>
    </main>
  );
}
