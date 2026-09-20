import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPercent, formatRate, toDecimal } from '@/lib/decimal';
import { requireOrg } from '@/lib/org';
import { listRuns } from '@/lib/runs';

export const metadata = { title: 'Production' };

const STATUSES = [
  ['', 'All'],
  ['planned', 'Planned'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
] as const;

const BADGE: Record<string, string> = {
  planned: 'bg-surface-sunken text-text-secondary',
  in_progress: 'bg-surface-accent text-accent-text',
  completed: 'bg-surface-positive text-positive',
  cancelled: 'bg-surface-sunken text-text-tertiary',
};

const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const org = await requireOrg();
  const { status } = await searchParams;
  const active = STATUSES.some(([value]) => value === status) ? (status ?? '') : '';
  const runs = await listRuns(org.id, active || undefined);

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">Production runs</h1>
          <p className="text-body mt-1 text-text-secondary">
            What you made, what it actually cost, and what went wrong.
          </p>
        </div>
        <ButtonLink href="/production/new">Start a run</ButtonLink>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map(([value, label]) => (
          <Link
            key={value || 'all'}
            href={value ? `/production?status=${value}` : '/production'}
            aria-current={active === value ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-body-sm ${active === value ? 'bg-surface-accent font-medium text-accent-text' : 'bg-surface text-text-secondary hover:bg-surface-sunken'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          action={<ButtonLink href="/production/new">Start a run</ButtonLink>}
        >
          A run records what you actually made. It consumes the real materials from stock and locks
          its cost at the rates in force that day, so a price change next month cannot rewrite what
          this one cost.
        </EmptyState>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          <table className="w-full min-w-[46rem]">
            <thead>
              <tr className="border-b border-border-strong">
                <th className={TH}>Date</th>
                <th className={TH}>Product</th>
                <th className={`${TH} text-right`}>Accepted</th>
                <th className={`${TH} text-right`}>Failed</th>
                <th className={`${TH} text-right`}>Cost per unit</th>
                <th className={`${TH} text-right`}>Against estimate</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const actual =
                  run.actual_cost_per_accepted_unit === null
                    ? null
                    : toDecimal(run.actual_cost_per_accepted_unit);
                const estimate =
                  run.estimated_unit_cost === null ? null : toDecimal(run.estimated_unit_cost);
                const against =
                  actual !== null && estimate !== null && estimate.gt(0)
                    ? actual.minus(estimate).dividedBy(estimate)
                    : null;
                return (
                  <tr key={run.id} className="border-b border-border-subtle last:border-b-0">
                    <td className={TD}>
                      <Link href={`/production/${run.id}`} className="text-accent-text underline">
                        {run.run_date}
                      </Link>
                    </td>
                    <td className={TD}>{run.item?.name ?? '—'}</td>
                    <td className={`${TD} text-right tabular-nums`}>{run.units_accepted ?? '—'}</td>
                    <td className={`${TD} text-right tabular-nums`}>{run.units_failed ?? '—'}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {actual === null ? '—' : formatRate(actual)}
                    </td>
                    <td
                      className={`${TD} text-right tabular-nums ${against !== null && against.gt(0) ? 'text-danger' : ''}`}
                    >
                      {against === null ? '—' : formatPercent(against)}
                    </td>
                    <td className={TD}>
                      <span
                        className={`text-caption rounded-full px-2 py-1 ${BADGE[run.status] ?? ''}`}
                      >
                        {run.status === 'in_progress'
                          ? 'In progress'
                          : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
