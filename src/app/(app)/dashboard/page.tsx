import Link from 'next/link';
import type Decimal from 'decimal.js';
import { formatPercent, formatQuantity, fromInteger, toDecimal } from '@/lib/decimal';
import { requireOrg } from '@/lib/org';
import { businessDate } from '@/lib/business-date';
import {
  VAT_THRESHOLD,
  inventoryValue,
  lowStock,
  monthOf,
  overheadRecovery,
  productionTotals,
  rollingYearTo,
  salesTotals,
  setupGaps,
  vatThreshold,
  wasteRate,
} from '@/lib/metrics';

export const metadata = { title: 'Dashboard — Production Costing' };

const CARD = 'rounded-card border border-border-strong bg-surface p-6';

const HUNDRED = fromInteger(100);
const NONE = fromInteger(0);

/**
 * The fill, as a percentage string, clamped to the track. An overshoot drawn
 * proportionally spills past the card edge, and the sentence below the bar
 * already says how far over it went (F-20). Clamped through Decimal because
 * D-079 bans the float coercion, date or percentage or otherwise.
 */
function barWidth(ratio: Decimal | null): string {
  if (ratio === null) return '0';
  const percent = ratio.times(HUNDRED);
  if (percent.lt(NONE)) return '0';
  if (percent.gt(HUNDRED)) return '100';
  return percent.toFixed(2);
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={CARD}>
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="text-heading-lg mt-2 tabular-nums text-text-primary">{value}</p>
      <p className="text-caption mt-1 text-text-tertiary">{sub}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const org = await requireOrg();
  const today = businessDate(org.timezone);
  const month = monthOf(today);

  const [inventory, production, sales, waste, low, gaps, vat] = await Promise.all([
    inventoryValue(org.id),
    productionTotals(org.id, month),
    salesTotals(org.id, month),
    wasteRate(org.id, month),
    lowStock(org.id),
    setupGaps(org.id),
    vatThreshold(org.id, today),
  ]);
  const overhead = await overheadRecovery(org.id, month, sales.contribution);
  const monthName = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    timeZone: org.timezone,
  }).format(new Date(`${today}T00:00:00Z`));

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <h1 className="text-title text-text-primary">{org.name}</h1>
      <p className="text-body mt-1 text-text-secondary">{monthName} at a glance</p>

      {gaps.length > 0 ? (
        <section className={`${CARD} mt-6`}>
          <h2 className="text-heading-sm text-text-primary">Finish setting up</h2>
          <p className="text-body-sm mt-1 text-text-secondary">
            {gaps.length} {gaps.length === 1 ? 'thing is' : 'things are'} still missing. Costs that
            need them will say so rather than guessing.
          </p>
          <ul className="text-body-sm mt-3 list-disc pl-5 text-text-secondary">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <Link
            href="/settings"
            className="text-body-sm mt-4 inline-block text-accent-text underline"
          >
            Continue setup
          </Link>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Inventory value"
          value={inventory.value.format()}
          sub={`${inventory.items} ${inventory.items === 1 ? 'item' : 'items'} on hand${inventory.uncosted > 0 ? `, ${inventory.uncosted} with no cost established` : ''}`}
        />
        <Stat
          label="Production cost this month"
          value={production.cost.format()}
          sub={`${production.runs} ${production.runs === 1 ? 'run' : 'runs'} completed`}
        />
        <Stat
          label="Revenue this month"
          value={sales.revenue.format()}
          sub={`${sales.sales} ${sales.sales === 1 ? 'sale' : 'sales'}`}
        />
        <Stat
          label="Contribution profit this month"
          value={sales.contribution === null ? 'Cost unknown' : sales.contribution.format()}
          sub={
            sales.withUnknownCost > 0
              ? `${sales.withUnknownCost} ${sales.withUnknownCost === 1 ? 'sale has' : 'sales have'} no established cost`
              : sales.contributionMargin === null
                ? 'No net revenue yet'
                : `${formatPercent(sales.contributionMargin)} of net revenue`
          }
        />
        <Stat
          label="Average contribution margin"
          value={sales.contributionMargin === null ? '—' : formatPercent(sales.contributionMargin)}
          sub="Across sales this month, after fees"
        />
        <Stat
          label="Waste rate"
          value={waste.rate === null ? '—' : formatPercent(waste.rate)}
          // A bare 100.0% reads as a catastrophe. It is literally true in a
          // month where the only material that left the shelf was waste, and
          // the two amounts beside it say which of those happened.
          sub={
            waste.rate === null
              ? 'No material left the shelf this month'
              : `${waste.wasted.format()} wasted of ${waste.consumed.format()} used`
          }
        />
        <Stat
          label="Failure rate"
          value={production.failureRate === null ? '—' : formatPercent(production.failureRate)}
          sub="Units rejected against units started, all products counted equally"
        />
      </div>

      {overhead !== null ? (
        <section className={`${CARD} mt-6`}>
          <h2 className="text-heading-sm text-text-primary">Overhead recovered this month</h2>
          <p className="text-heading-md mt-2 tabular-nums text-text-primary">
            {overhead.recovered === null ? 'Cost unknown' : overhead.recovered.format()} of{' '}
            {overhead.pool.format()}
          </p>
          {overhead.recovered !== null ? (
            <>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                {/* Clamped: an overshoot drawn proportionally spills past the
                    card, and the words below already say it (F-20). */}
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${barWidth(overhead.ratio)}%` }}
                />
              </div>
              <p className="text-body-sm mt-3 text-text-secondary">
                {overhead.recovered.compare(overhead.pool) < 0
                  ? `${overhead.pool.minus(overhead.recovered).format()} short of covering this month's running costs.`
                  : `Running costs covered. ${overhead.recovered.minus(overhead.pool).format()} beyond them so far.`}
              </p>
            </>
          ) : null}
          <p className="text-caption mt-3 text-text-tertiary">
            Overhead is not charged to each product. It is covered by the total contribution profit
            your sales produce. When this bar passes the line, the month has paid for itself.
          </p>
        </section>
      ) : null}

      <section className={`${CARD} mt-6`}>
        <h2 className="text-heading-sm text-text-primary">Sales against the VAT threshold</h2>
        <p className="text-heading-md mt-2 tabular-nums text-text-primary">
          {vat.revenue.format()} of {VAT_THRESHOLD.format()}
        </p>
        <p className="text-caption mt-1 text-text-tertiary">
          Rolling 12 months to {rollingYearTo(today).to}
        </p>
        <p className="text-body-sm mt-3 text-text-secondary">
          {vat.ratio.gte(toDecimal('0.8'))
            ? 'You are approaching ₱3,000,000. Businesses must register for VAT within 30 days of the end of the month in which they cross it. Worth raising with your accountant.'
            : 'You are below the registration threshold.'}
        </p>
        <p className="text-caption mt-3 text-text-tertiary">
          This is a count of your recorded sales, not tax advice.
        </p>
      </section>

      <section className={`${CARD} mt-6`}>
        <h2 className="text-heading-sm text-text-primary">Low stock</h2>
        {low.length === 0 ? (
          <p className="text-body-sm mt-2 text-text-secondary">
            Nothing is below its reorder point.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border-subtle">
            {low.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3">
                <span className="text-body-sm text-text-primary">{item.name}</span>
                <span className="text-body-sm tabular-nums text-text-secondary">
                  {formatQuantity(item.qty_on_hand, item.unit ?? undefined)} left · Reorder at{' '}
                  {formatQuantity(item.reorder_point, item.unit ?? undefined)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/items" className="text-body-sm mt-4 inline-block text-accent-text underline">
          View all items
        </Link>
      </section>

      <p className="text-caption mt-6 text-text-tertiary">
        Every figure here is computed by one definition in <code>src/lib/metrics.ts</code>, which
        the reports use as well, so a card and a report cannot disagree.
      </p>
    </main>
  );
}
