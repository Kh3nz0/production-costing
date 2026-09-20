'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeRun } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { formatCalculationAmount, formatQuantity, toDecimal } from '@/lib/decimal';

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const CONTROL =
  'h-field w-full rounded-control border border-border-control bg-surface px-3 text-body text-text-primary';
const TH = 'px-4 py-3 text-left text-caption font-medium text-text-secondary';
const TD = 'px-4 py-3 text-body-sm text-text-primary';

/**
 * Postgres hands back `numeric(20,6)` as `251.160000`, and the Expected column
 * beside it reads `251.16 g`. The same number spelled two ways on one row reads
 * as two numbers. The value is untouched: only its trailing zeros go.
 */
function trimZeros(value: string | null): string {
  if (value === null || value === '') return '';
  return toDecimal(value).toString();
}

interface DraftLine {
  id: string;
  line_type: string;
  label: string;
  unit: string | null;
  expected_qty: string | null;
  actual_qty: string | null;
}

interface WasteLine {
  key: string;
  item_id: string;
  qty: string;
  reason: string;
}

export function RecordRunForm({
  runId,
  lines,
  unitsStarted,
  estimate,
  items,
}: {
  runId: string;
  lines: DraftLine[];
  unitsStarted: number | null;
  estimate: string | null;
  items: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(completeRun, {});
  const [actual, setActual] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [line.id, trimZeros(line.actual_qty ?? line.expected_qty)]),
    ),
  );
  const [accepted, setAccepted] = useState('');
  const [failed, setFailed] = useState('');
  const [waste, setWaste] = useState<WasteLine[]>([]);

  if (state.saved === true) router.refresh();

  const started =
    /^\d+$/.test(accepted) && /^\d+$/.test(failed)
      ? toDecimal(accepted).plus(toDecimal(failed)).toFixed(0)
      : null;

  return (
    <form action={action} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="run_id" value={runId} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map((line) => ({ id: line.id, actual_qty: actual[line.id] ?? '' })),
        )}
      />
      <input
        type="hidden"
        name="waste"
        value={JSON.stringify(
          waste.map((line) => ({ item_id: line.item_id, qty: line.qty, reason: line.reason })),
        )}
      />

      <section className={CARD}>
        <h2 className="text-heading-sm text-text-primary">What was actually used</h2>
        <p className="text-body-sm mt-1 text-text-secondary">
          Quantities default to what the recipe expected. Change anything that differed. Machine and
          labour time are totals for the whole batch, not per unit.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-strong">
                <th className={TH}>Line</th>
                <th className={`${TH} text-right`}>Expected</th>
                <th className={`${TH} text-right`}>Actual</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-border-subtle">
                  <td className={TD}>
                    {line.label}
                    <span className="text-caption ml-2 text-text-tertiary">
                      {line.line_type === 'machine_time'
                        ? 'machine time'
                        : line.line_type === 'labour'
                          ? 'labour'
                          : line.line_type}
                    </span>
                  </td>
                  <td className={`${TD} text-right tabular-nums text-text-secondary`}>
                    {line.expected_qty === null
                      ? '—'
                      : formatQuantity(line.expected_qty, line.unit ?? undefined)}
                  </td>
                  <td className={`${TD} text-right`}>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={actual[line.id] ?? ''}
                      onChange={(e) => setActual((all) => ({ ...all, [line.id]: e.target.value }))}
                      className="h-field w-40 rounded-control border border-border-control bg-surface px-3 text-right text-body tabular-nums text-text-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-heading-sm text-text-primary">What came out</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Accepted units"
            name="units_accepted"
            type="number"
            min="0"
            step="1"
            value={accepted}
            onChange={(e) => setAccepted(e.target.value)}
            helper="Units good enough to sell or use."
            required
          />
          <Field
            label="Failed units"
            name="units_failed"
            type="number"
            min="0"
            step="1"
            value={failed}
            onChange={(e) => setFailed(e.target.value)}
            helper="Units rejected. These do not go into stock."
            required
          />
        </div>
        {started !== null ? (
          <p className="text-body-sm mt-4 rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
            {started} units started
            {unitsStarted !== null && started !== String(unitsStarted)
              ? `, against the ${unitsStarted} this run planned to start.`
              : '.'}
          </p>
        ) : null}

        <h3 className="text-body mt-6 font-medium text-text-primary">Wasted material</h3>
        <p className="text-body-sm mt-1 text-text-secondary">
          Material thrown away beyond what the recipe expected: a failed purge, a spill, a spool
          that jammed. It left the shelf and you paid for it, so it counts as part of what this run
          cost.
        </p>
        {waste.map((line, index) => (
          <div key={line.key} className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto]">
            <label className="text-caption text-text-secondary">
              Item
              <select
                value={line.item_id}
                onChange={(e) =>
                  setWaste((all) =>
                    all.map((w) => (w.key === line.key ? { ...w, item_id: e.target.value } : w)),
                  )
                }
                className={CONTROL}
              >
                <option value="">Choose</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-caption text-text-secondary">
              Quantity
              <input
                type="number"
                step="any"
                min="0"
                value={line.qty}
                onChange={(e) =>
                  setWaste((all) =>
                    all.map((w) => (w.key === line.key ? { ...w, qty: e.target.value } : w)),
                  )
                }
                className={CONTROL}
              />
            </label>
            <label className="text-caption text-text-secondary">
              Reason
              <input
                value={line.reason}
                onChange={(e) =>
                  setWaste((all) =>
                    all.map((w) => (w.key === line.key ? { ...w, reason: e.target.value } : w)),
                  )
                }
                className={CONTROL}
              />
            </label>
            <button
              type="button"
              onClick={() => setWaste((all) => all.filter((w) => w.key !== line.key))}
              className="text-body-sm self-end pb-2 text-danger underline"
              aria-label={`Remove waste line ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setWaste((all) => [
              ...all,
              { key: crypto.randomUUID(), item_id: '', qty: '', reason: '' },
            ])
          }
          className="text-body-sm mt-4 text-accent-text underline"
        >
          Add wasted material
        </button>
      </section>

      <section className={CARD}>
        <h2 className="text-heading-sm text-text-primary">Before you complete this run</h2>
        <p className="text-body-sm mt-1 text-text-secondary">
          Once completed, this run&rsquo;s cost is locked. Later price changes will not alter it.
          The cost is worked out from the quantities above at the rates in force on the run&rsquo;s
          date, and the figures appear here once it is done.
        </p>
        {estimate !== null ? (
          <p className="text-body-sm mt-3 text-text-secondary">
            The recipe estimated {formatCalculationAmount(estimate)} per unit. The run will be
            reported against that.
          </p>
        ) : null}
        <Field label="Notes" name="notes" />
        {state.error !== undefined ? (
          <p role="alert" className="text-body-sm mt-4 text-danger">
            {state.error}
          </p>
        ) : null}
        <div className="mt-5">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Completing…' : 'Complete run'}
          </Button>
        </div>
      </section>
    </form>
  );
}
