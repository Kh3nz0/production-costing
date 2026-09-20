import Link from 'next/link';
import { REPORTS } from '@/lib/report-types';
import { requireOrg } from '@/lib/org';

export const metadata = { title: 'Reports — Production Costing' };

export default async function ReportsPage() {
  await requireOrg();
  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <h1 className="text-title text-text-primary">Reports</h1>
      <p className="text-body mt-1 text-text-secondary">
        Filter by date, read on screen, export to CSV.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <li key={report.slug}>
            <Link
              href={`/reports/${report.slug}`}
              className="block rounded-card border border-border-strong bg-surface p-6 hover:bg-surface-sunken"
            >
              <span className="text-heading-sm block text-text-primary">{report.title}</span>
              <span className="text-body-sm mt-1 block text-text-secondary">
                {report.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
