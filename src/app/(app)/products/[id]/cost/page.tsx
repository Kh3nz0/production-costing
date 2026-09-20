import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Decimal,
  formatCalculationAmount,
  formatCalculationRate,
  formatExactRate,
  formatPercent,
  formatQuantity,
  toDecimal,
} from '@/lib/decimal';
import { requireOrg } from '@/lib/org';
import { getProduct, getProductCost } from '@/lib/products';
import { ProductTabs } from '../product-tabs';
import { businessDate } from '@/lib/business-date';

export default async function ProductCostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ on?: string }>;
}) {
  const org = await requireOrg();
  const { id } = await params;
  const product = await getProduct(id, org.id);
  if (!product) notFound();
  const query = await searchParams;
  const on =
    query.on && /^\d{4}-\d{2}-\d{2}$/.test(query.on) ? query.on : businessDate(org.timezone);
  const cost = await getProductCost(product, on);
  const output = product.expected_output_qty_per_run
    ? toDecimal(product.expected_output_qty_per_run)
    : null;
  const start =
    cost && output && cost.failureRate !== null
      ? output.div(new Decimal(1).minus(cost.failureRate)).ceil()
      : null;
  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <Link href="/products" className="text-caption text-accent-text underline">
        Products
      </Link>
      <h1 className="text-title mt-1 text-text-primary">{product.name}</h1>
      <p className="text-body mt-1 text-text-secondary">
        Where every peso goes, and where each figure came from.
      </p>
      <ProductTabs id={id} active="cost" />
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-caption text-text-secondary">
          Rate date
          <input
            type="date"
            name="on"
            defaultValue={on}
            className="ml-2 h-field rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
          />
        </label>
        <button
          type="submit"
          className="h-field rounded-control bg-accent px-4 text-body-sm font-medium text-text-inverse"
        >
          Show cost
        </button>
      </form>
      <p className="text-caption mt-2 text-text-secondary">
        Materials use their current average cost. Equipment, labour, electricity and overhead use
        the rates in force on the selected date.
      </p>
      {!cost ? (
        <section className="mt-6 rounded-card border border-border-strong bg-surface p-9">
          <h2 className="text-heading-sm text-text-primary">No recipe yet</h2>
          <p className="text-body-sm mt-2 text-text-secondary">
            Add what goes into one unit and a cost will be worked out from it.
          </p>
          <Link
            href={`/products/${id}/recipe`}
            className="text-body-sm mt-4 inline-block text-accent-text underline"
          >
            Add a recipe
          </Link>
        </section>
      ) : (
        <>
          {cost.missing.length > 0 && (
            <section
              role="alert"
              className="mt-6 rounded-card border border-warning bg-surface p-5"
            >
              <h2 className="text-heading-sm text-text-primary">This cost is incomplete</h2>
              <p className="text-body-sm mt-1 text-text-secondary">
                {cost.missing.length} things are missing, so the total is lower than reality.
              </p>
              <ul className="text-body-sm mt-3 list-disc pl-5 text-danger">
                {cost.missing.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-border-strong bg-surface p-6">
              <h2 className="text-caption text-text-secondary">Production cost per unit</h2>
              <p className="text-title mt-2 tabular text-text-primary">
                {formatCalculationAmount(cost.displayInventory)}
              </p>
              <p className="text-caption mt-2 text-text-secondary">
                This is what one good unit is worth in stock. Overhead is excluded.
              </p>
            </div>
            <div className="rounded-card border border-border-strong bg-surface p-6">
              <h2 className="text-caption text-text-secondary">Full cost with overhead</h2>
              <p className="text-title mt-2 tabular text-text-primary">
                {formatCalculationAmount(cost.displayFull)}
              </p>
              <p className="text-caption mt-2 text-text-secondary">
                Use this when setting a price. Overhead does not become stock value.
              </p>
            </div>
          </section>
          <section className="mt-6 rounded-card border border-border-strong bg-surface p-6">
            <h2 className="text-heading-sm text-text-primary">Cost breakdown</h2>
            <p className="text-caption mt-1 text-text-tertiary">
              Amounts show four decimal places. Expand a row for the quantity, rate and effective
              date.
            </p>
            <div className="mt-4 divide-y divide-border-strong">
              {cost.rows.map((row) => (
                <details key={row.id} className="py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-body-sm text-text-primary">
                    <span>
                      {row.label}
                      {row.missing ? <span className="ml-2 text-danger">Missing</span> : null}
                    </span>
                    <span className="tabular font-medium">
                      {row.displayAmount === null
                        ? 'Excluded'
                        : formatCalculationAmount(row.displayAmount)}
                    </span>
                  </summary>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-caption text-text-secondary sm:grid-cols-2">
                    {row.inputs.map((input) => (
                      <div key={input.label}>
                        <dt className="text-text-tertiary">{input.label}</dt>
                        <dd className="tabular">{input.value}</dd>
                      </div>
                    ))}
                    {row.displayAmount !== null && (
                      <div>
                        <dt className="text-text-tertiary">Amount shown</dt>
                        <dd className="tabular">{formatCalculationAmount(row.displayAmount)}</dd>
                      </div>
                    )}
                  </dl>
                </details>
              ))}
              <p className="flex justify-between gap-4 py-3 text-body-sm font-medium text-text-primary">
                <span>Direct cost from rows</span>
                <span className="tabular">{formatCalculationAmount(cost.displayDirect)}</span>
              </p>
              <details className="py-3">
                <summary className="flex cursor-pointer justify-between gap-3 text-body-sm text-text-primary">
                  <span>Expected failure allowance</span>
                  <span className="tabular">
                    {cost.failureRate === null
                      ? 'Excluded'
                      : formatCalculationAmount(cost.displayFailure)}
                  </span>
                </summary>
                <p className="text-caption mt-2 text-text-secondary">
                  {cost.failureRate === null
                    ? 'Set an expected failure rate to complete this estimate.'
                    : `At ${formatPercent(cost.failureRate)} expected failure, the cost of started units is spread across the good units.`}{' '}
                  {cost.failureRate !== null && (
                    <> Rate used: {cost.failureRate.times(100).toString()}%.</>
                  )}
                </p>
              </details>
              {!cost.displayRounding.isZero() && (
                <details className="py-3">
                  <summary className="flex cursor-pointer justify-between gap-3 text-body-sm text-text-primary">
                    <span>Rounding adjustment</span>
                    <span className="tabular">{formatCalculationAmount(cost.displayRounding)}</span>
                  </summary>
                  <p className="text-caption mt-2 text-text-secondary">
                    Each row is displayed to four places. This difference makes their sum match the
                    production cost calculated before rounding.
                  </p>
                </details>
              )}
              <p className="flex justify-between gap-4 py-4 text-body font-semibold text-text-primary">
                <span>Production cost per unit</span>
                <span className="tabular">{formatCalculationAmount(cost.displayInventory)}</span>
              </p>
              <details className="py-3">
                <summary className="flex cursor-pointer justify-between gap-3 text-body-sm text-text-primary">
                  <span>Overhead</span>
                  <span className="tabular">
                    {cost.displayOverhead === null
                      ? 'Excluded'
                      : formatCalculationAmount(cost.displayOverhead)}
                  </span>
                </summary>
                <div className="mt-2 space-y-1 text-caption text-text-secondary">
                  <p>Attended labour: {formatQuantity(cost.attendedHours, 'h')}.</p>
                  {cost.overheadRule ? (
                    <>
                      <p>Method: {cost.overheadRule.method.replaceAll('_', ' ')}.</p>
                      <p>Rate effective from: {cost.overheadRule.effectiveFrom}.</p>
                      {cost.overheadRule.rate !== null && (
                        <div>
                          <p>
                            Rate: {formatCalculationRate(cost.overheadRule.rate)}{' '}
                            {cost.overheadRule.method === 'per_attended_hour'
                              ? '/ attended hour'
                              : cost.overheadRule.method === 'flat_per_unit'
                                ? '/ unit'
                                : ''}
                          </p>
                          {!toDecimal(cost.overheadRule.rate).eq(
                            toDecimal(cost.overheadRule.rate).toDecimalPlaces(6),
                          ) && <p>Exact rate used: {formatExactRate(cost.overheadRule.rate)}.</p>}
                        </div>
                      )}
                      {cost.overheadRule.percent !== null && (
                        <p>
                          Share of direct cost:{' '}
                          {toDecimal(cost.overheadRule.percent).times(100).toString()}%.
                        </p>
                      )}
                    </>
                  ) : (
                    <p>No overhead rate in force.</p>
                  )}
                  <p>Overhead is used for pricing only.</p>
                </div>
              </details>
              {!cost.displayFullRounding.isZero() && (
                <details className="py-3">
                  <summary className="flex cursor-pointer justify-between gap-3 text-body-sm text-text-primary">
                    <span>Rounding adjustment</span>
                    <span className="tabular">
                      {formatCalculationAmount(cost.displayFullRounding)}
                    </span>
                  </summary>
                  <p className="text-caption mt-2 text-text-secondary">
                    Reconciles the displayed production cost and overhead with the full cost
                    calculated before rounding.
                  </p>
                </details>
              )}
              <p className="flex justify-between gap-4 py-4 text-body font-semibold text-text-primary">
                <span>Full cost with overhead</span>
                <span className="tabular">{formatCalculationAmount(cost.displayFull)}</span>
              </p>
            </div>
          </section>
          {output && start && (
            <section className="mt-6 rounded-card border border-border-strong bg-surface p-6">
              <h2 className="text-heading-sm text-text-primary">
                For a batch of {formatQuantity(output)}
              </h2>
              <dl className="mt-4 grid gap-3 text-body-sm sm:grid-cols-2">
                <div>
                  <dt className="text-text-secondary">Units to start</dt>
                  <dd className="font-medium text-text-primary">{formatQuantity(start)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Expected failures</dt>
                  <dd className="font-medium text-text-primary">
                    {formatQuantity(start.minus(output))}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Estimated batch cost</dt>
                  <dd className="font-medium text-text-primary">
                    {formatCalculationAmount(cost.fullExact.times(output))}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Estimated cost per accepted unit</dt>
                  <dd className="font-medium text-text-primary">
                    {formatCalculationAmount(cost.displayInventory)}
                  </dd>
                </div>
              </dl>
            </section>
          )}
        </>
      )}
    </main>
  );
}
