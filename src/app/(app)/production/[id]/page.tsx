import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatPercent,
  formatQuantity,
  formatRate,
  fromInteger,
  roundHalfUp,
  toDecimal,
} from '@/lib/decimal';
import { Money } from '@/lib/money';
import { requireOrg } from '@/lib/org';
import { getRun, getRunLineLabels } from '@/lib/runs';
import { getRecipeOptions } from '@/lib/products';
import { RecordRunForm } from './record-run-form';
import { ReverseRunForm } from './reverse-run-form';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const run = await getRun(id, org.id);
  return { title: `${run?.item?.name ?? 'Run'} — ${run?.run_date ?? ''}` };
}

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const run = await getRun(id, org.id);
  if (!run) notFound();

  const [labels, options] = await Promise.all([
    getRunLineLabels(run.lines),
    getRecipeOptions(org.id),
  ]);
  const done = run.status === 'completed';

  const total =
    run.actual_total_cost_cents === null
      ? null
      : Money.fromCentavos(BigInt(run.actual_total_cost_cents));
  const loss =
    run.abnormal_loss_cents === null ? null : Money.fromCentavos(BigInt(run.abnormal_loss_cents));
  const capitalised =
    run.capitalised_cost_cents === null
      ? null
      : Money.fromCentavos(BigInt(run.capitalised_cost_cents));
  const perUnit =
    run.actual_cost_per_accepted_unit === null
      ? null
      : toDecimal(run.actual_cost_per_accepted_unit);
  const estimate = run.estimated_unit_cost === null ? null : toDecimal(run.estimated_unit_cost);
  const against =
    perUnit !== null && estimate !== null && estimate.gt(0)
      ? { amount: perUnit.minus(estimate), fraction: perUnit.minus(estimate).dividedBy(estimate) }
      : null;
  const naive =
    total !== null && run.units_accepted !== null && run.units_accepted > 0
      ? total.dividedByExact(toDecimal(String(run.units_accepted)))
      : null;
  // Half-up through Decimal, the same way the database did it, rather than
  // Math.round over two float coercions D-079 bans.
  const snapshotRate = run.rate_snapshot?.expected_failure_rate;
  const expectedFailed =
    run.units_started !== null &&
    (typeof snapshotRate === 'string' || typeof snapshotRate === 'number')
      ? roundHalfUp(
          fromInteger(run.units_started).times(toDecimal(String(snapshotRate))),
          0,
        ).toFixed(0)
      : null;

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <Link href="/production" className="text-caption text-accent-text underline">
        Production
      </Link>
      <h1 className="text-title mt-1 text-text-primary">
        {run.item?.name ?? 'Run'} — {run.run_date}
      </h1>

      {done ? (
        <>
          <section className={`${CARD} mt-6`}>
            <h2 className="text-heading-sm text-text-primary">Run completed</h2>
            <p className="text-body mt-1 text-text-secondary">
              {run.units_accepted} units added to stock at{' '}
              {perUnit === null ? '—' : formatRate(perUnit)} each. Cost locked.
            </p>
          </section>

          {run.units_failed !== null && expectedFailed !== null && run.units_failed > 0 ? (
            <section className={`${CARD} mt-6`}>
              <h2 className="text-heading-sm text-text-primary">
                {toDecimal(String(run.units_failed)).gt(toDecimal(expectedFailed))
                  ? 'More failed than expected'
                  : 'Failures within expectation'}
              </h2>
              {toDecimal(String(run.units_failed)).gt(toDecimal(expectedFailed)) ? (
                <>
                  <p className="text-body mt-2 text-text-secondary">
                    {run.units_failed} units failed. At your expected rate, about {expectedFailed}{' '}
                    was normal. The other{' '}
                    {toDecimal(String(run.units_failed))
                      .minus(toDecimal(expectedFailed))
                      .toFixed(0)}{' '}
                    cost {loss?.format() ?? '—'}, and that is recorded as a production loss rather
                    than added to the value of the good units.
                  </p>
                  {naive !== null && perUnit !== null ? (
                    <p className="text-body-sm mt-3 text-text-secondary">
                      Without this, your {run.units_accepted} good units would each appear to cost{' '}
                      {formatRate(naive)} instead of {formatRate(perUnit)}, and a bad night would
                      look like an expensive product.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-body mt-2 text-text-secondary">
                  {run.units_failed} failed, and you expected about {expectedFailed}. That is
                  normal, so their cost is spread across the {run.units_accepted} accepted units.
                </p>
              )}
            </section>
          ) : null}

          <section className={`${CARD} mt-6`}>
            <h2 className="text-heading-sm text-text-primary">What this run cost</h2>
            <dl className="mt-4 divide-y divide-border-subtle">
              {(
                [
                  ['Actual run cost', total?.format() ?? '—'],
                  ['Units started', String(run.units_started ?? '—')],
                  ['Units accepted', String(run.units_accepted ?? '—')],
                  ['Units failed', String(run.units_failed ?? '—')],
                  ['Cost carried into stock', capitalised?.format() ?? '—'],
                  ['Production loss', loss?.format() ?? '—'],
                  ['Cost per accepted unit', perUnit === null ? '—' : formatRate(perUnit)],
                  ['Estimated cost per unit', estimate === null ? '—' : formatRate(estimate)],
                  [
                    'Difference',
                    against === null
                      ? '—'
                      : `${formatRate(against.amount.abs())} ${against.amount.isNegative() ? 'under' : 'over'} estimate, ${formatPercent(against.fraction.abs())}`,
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-3">
                  <dt className="text-body-sm text-text-secondary">{label}</dt>
                  <dd className="text-body-sm tabular-nums text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${CARD} mt-6`}>
            <h2 className="text-heading-sm text-text-primary">What was used</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[44rem]">
                <thead>
                  <tr className="border-b border-border-strong">
                    <th className={TH}>Line</th>
                    <th className={`${TH} text-right`}>Expected</th>
                    <th className={`${TH} text-right`}>Actual</th>
                    <th className={`${TH} text-right`}>Rate used</th>
                    <th className={`${TH} text-right`}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {run.lines.flatMap((line) => {
                    const ref =
                      line.ref_item_id ?? line.ref_equipment_id ?? line.ref_activity_id ?? '';
                    const label = labels.get(ref);

                    // A machine line carries its own electricity, because the
                    // ledger has no electricity line to put it on. Left as one
                    // row it is the only row on the page whose rate times
                    // quantity does not equal its cost. Split it: the machine
                    // part is computed, and the remainder is the electricity,
                    // so the two still add to exactly what was stored.
                    let electricity: { amount: Money; detail: string } | null = null;
                    if (
                      line.line_type === 'machine_time' &&
                      line.cost_cents !== null &&
                      line.unit_cost_at_run !== null &&
                      line.actual_qty !== null
                    ) {
                      const machinePart = Money.fromDecimal(
                        toDecimal(line.actual_qty).times(toDecimal(line.unit_cost_at_run)),
                      );
                      const whole = Money.fromCentavos(BigInt(line.cost_cents));
                      const remainder = whole.minus(machinePart);
                      if (!remainder.isZero()) {
                        const snapshot = run.rate_snapshot?.electricity as
                          { rate_per_kwh?: string | number; watts?: string | number } | undefined;
                        electricity = {
                          amount: remainder,
                          detail:
                            snapshot?.watts !== undefined && snapshot?.rate_per_kwh !== undefined
                              ? `${formatQuantity(String(snapshot.watts))} W at ${formatRate(String(snapshot.rate_per_kwh))} per kWh`
                              : 'derived from the machine hours',
                        };
                      }
                    }

                    const rows = [
                      <tr key={line.id} className="border-b border-border-subtle">
                        <td className={TD}>{label?.name ?? line.line_type}</td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {line.expected_qty === null
                            ? '—'
                            : formatQuantity(line.expected_qty, label?.unit ?? undefined)}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {line.actual_qty === null
                            ? '—'
                            : formatQuantity(line.actual_qty, label?.unit ?? undefined)}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {line.unit_cost_at_run === null ? '—' : formatRate(line.unit_cost_at_run)}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {line.cost_cents === null
                            ? '—'
                            : electricity === null
                              ? Money.fromCentavos(BigInt(line.cost_cents)).format()
                              : Money.fromCentavos(BigInt(line.cost_cents))
                                  .minus(electricity.amount)
                                  .format()}
                        </td>
                      </tr>,
                    ];
                    if (electricity !== null) {
                      rows.push(
                        <tr
                          key={`${line.id}-electricity`}
                          className="border-b border-border-subtle"
                        >
                          <td className={TD}>
                            Electricity
                            <span className="text-caption ml-2 text-text-tertiary">
                              {electricity.detail}
                            </span>
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>—</td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {line.actual_qty === null ? '—' : formatQuantity(line.actual_qty, 'h')}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>—</td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {electricity.amount.format()}
                          </td>
                        </tr>,
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-caption mt-4 text-text-tertiary">
              These rates are the ones in force on {run.run_date}, stored on the run. Changing a
              price today does not change what this run cost.
            </p>
          </section>

          <ReverseRunForm runId={run.id} />
        </>
      ) : run.status === 'cancelled' ? (
        <section className={`${CARD} mt-6`}>
          <h2 className="text-heading-sm text-text-primary">Run reversed</h2>
          <p className="text-body mt-1 text-text-secondary">
            {run.notes ?? 'Every movement this run made has been undone.'} The original movements
            and their reversals are both on the inventory record.
          </p>
        </section>
      ) : (
        <RecordRunForm
          runId={run.id}
          lines={run.lines.map((line) => ({
            id: line.id,
            line_type: line.line_type,
            expected_qty: line.expected_qty,
            actual_qty: line.actual_qty,
            label:
              labels.get(line.ref_item_id ?? line.ref_equipment_id ?? line.ref_activity_id ?? '')
                ?.name ?? line.line_type,
            unit:
              labels.get(line.ref_item_id ?? line.ref_equipment_id ?? line.ref_activity_id ?? '')
                ?.unit ?? null,
          }))}
          unitsStarted={run.units_started}
          estimate={run.estimated_unit_cost}
          items={options.items.map((item) => ({ id: item.id, name: item.name }))}
        />
      )}
    </main>
  );
}
