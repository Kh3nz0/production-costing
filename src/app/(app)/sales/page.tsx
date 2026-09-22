import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPercent, toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';
import { requireOrg } from '@/lib/org';
import { listSales } from '@/lib/runs';

export const metadata = { title: 'Sales' };

const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';

export default async function SalesPage() {
  const org = await requireOrg();
  const sales = await listSales(org.id);
  const displaySales = sales.map((sale) => {
    const contribution =
      sale.contribution_profit_cents === null
        ? null
        : Money.fromCentavos(BigInt(sale.contribution_profit_cents));
    const net = Money.fromCentavos(BigInt(sale.net_revenue_cents));
    const margin =
      contribution === null || net.isZero()
        ? null
        : contribution.toDecimal().dividedBy(net.toDecimal());
    return {
      id: sale.id,
      date: sale.sale_date,
      channel: sale.channel?.name ?? 'Direct',
      products: sale.lines
        .map((line) => `${toDecimal(line.quantity).toString()} × ${line.item?.name ?? '—'}`)
        .join(', '),
      revenue: Money.fromCentavos(BigInt(sale.revenue_cents)).format(),
      contribution: contribution === null ? 'Cost unknown' : contribution.format(),
      contributionNegative: contribution?.isNegative() ?? false,
      margin: margin === null ? '—' : formatPercent(margin),
      payment: sale.payment_status === 'paid' ? 'Paid' : 'Unpaid',
      estimated: sale.cost_source === 'estimate',
    };
  });

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">Sales</h1>
          <p className="text-body mt-1 text-text-secondary">
            What you sold and what you actually kept.
          </p>
        </div>
        <ButtonLink href="/sales/new">Record a sale</ButtonLink>
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="Nothing sold yet"
          action={<ButtonLink href="/sales/new">Record a sale</ButtonLink>}
        >
          A sale takes its cost from the stock it came out of, so what it earned is worked out from
          what those units actually cost to make &mdash; not from a guess, and not from
          today&rsquo;s material prices.
        </EmptyState>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border-strong overflow-hidden rounded-card border border-border-strong bg-surface lg:hidden">
            {displaySales.map((sale) => (
              <li key={sale.id} className="p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <Link
                    href={`/sales/${sale.id}`}
                    className="min-w-0 break-words text-body font-medium text-text-primary underline-offset-2 hover:underline"
                  >
                    {sale.products}
                  </Link>
                  <p className="shrink-0 text-body-sm tabular text-text-primary">{sale.revenue}</p>
                </div>
                <p className="text-caption mt-1 text-text-secondary">
                  {sale.date} · {sale.channel}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-caption text-text-tertiary">Contribution profit</dt>
                    <dd
                      className={`text-body-sm tabular ${sale.contributionNegative ? 'text-danger' : 'text-text-primary'}`}
                    >
                      {sale.contribution}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-tertiary">Margin</dt>
                    <dd className="text-body-sm tabular text-text-primary">{sale.margin}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-tertiary">Status</dt>
                    <dd className="text-body-sm text-text-primary">
                      {sale.payment}
                      {sale.estimated ? ' · Estimated cost' : ''}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div
            role="region"
            aria-label="Sales table"
            tabIndex={0}
            className="mt-6 hidden overflow-x-auto rounded-card border border-border-strong bg-surface lg:block"
          >
            <table className="w-full min-w-[46rem]">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className={TH}>Date</th>
                  <th className={TH}>Channel</th>
                  <th className={TH}>Products</th>
                  <th className={`${TH} text-right`}>Revenue</th>
                  <th className={`${TH} text-right`}>Contribution profit</th>
                  <th className={`${TH} text-right`}>Margin</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displaySales.map((sale) => {
                  return (
                    <tr key={sale.id} className="border-b border-border-subtle last:border-b-0">
                      <td className={TD}>{sale.date}</td>
                      <td className={TD}>{sale.channel}</td>
                      <td className={TD}>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {sale.products}
                        </Link>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{sale.revenue}</td>
                      <td
                        className={`${TD} text-right tabular-nums ${sale.contributionNegative ? 'text-danger' : ''}`}
                      >
                        {sale.contribution}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{sale.margin}</td>
                      <td className={TD}>
                        <span className="text-caption rounded-full bg-surface-sunken px-2 py-1 text-text-secondary">
                          {sale.payment}
                        </span>
                        {sale.estimated ? (
                          <span className="text-caption ml-2 rounded-full bg-surface-sunken px-2 py-1 text-text-tertiary">
                            Estimated cost
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
