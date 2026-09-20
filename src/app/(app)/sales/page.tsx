import Link from 'next/link';
import { formatPercent, toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';
import { requireOrg } from '@/lib/org';
import { listSales } from '@/lib/runs';

export const metadata = { title: 'Sales — Production Costing' };

const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';

export default async function SalesPage() {
  const org = await requireOrg();
  const sales = await listSales(org.id);

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">Sales</h1>
          <p className="text-body mt-1 text-text-secondary">
            What you sold and what you actually kept.
          </p>
        </div>
        <Link
          href="/sales/new"
          className="text-body-sm h-control-md inline-flex items-center rounded-control bg-accent px-4 font-medium text-white"
        >
          Record a sale
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className="text-body mt-6 rounded-card border border-border-strong bg-surface p-6 text-text-secondary">
          Nothing sold yet. A sale takes its cost from the stock it came out of, so what it earned
          is worked out from what those units actually cost to make.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
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
              {sales.map((sale) => {
                const contribution =
                  sale.contribution_profit_cents === null
                    ? null
                    : Money.fromCentavos(BigInt(sale.contribution_profit_cents));
                const net = Money.fromCentavos(BigInt(sale.net_revenue_cents));
                const margin =
                  contribution === null || net.isZero()
                    ? null
                    : contribution.toDecimal().dividedBy(net.toDecimal());
                return (
                  <tr key={sale.id} className="border-b border-border-subtle last:border-b-0">
                    <td className={TD}>{sale.sale_date}</td>
                    <td className={TD}>{sale.channel?.name ?? 'Direct'}</td>
                    <td className={TD}>
                      {sale.lines
                        .map(
                          (line) =>
                            `${toDecimal(line.quantity).toString()} × ${line.item?.name ?? '—'}`,
                        )
                        .join(', ')}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {Money.fromCentavos(BigInt(sale.revenue_cents)).format()}
                    </td>
                    <td
                      className={`${TD} text-right tabular-nums ${contribution !== null && contribution.isNegative() ? 'text-danger' : ''}`}
                    >
                      {contribution === null ? 'Cost unknown' : contribution.format()}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {margin === null ? '—' : formatPercent(margin)}
                    </td>
                    <td className={TD}>
                      <span className="text-caption rounded-full bg-surface-sunken px-2 py-1 text-text-secondary">
                        {sale.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                      {sale.cost_source === 'estimate' ? (
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
      )}
    </main>
  );
}
