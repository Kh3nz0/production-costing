'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveSetting } from '../../settings/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const CONTROL =
  'h-field w-full rounded-control border border-border-control bg-surface px-3 text-body text-text-primary';

const TODAY = new Date().toISOString().slice(0, 10);

export function OnboardingStep({
  step,
  index,
  next,
  energyUnits,
  business,
  gaps,
}: {
  step: string;
  index: number;
  next: string | null;
  energyUnits: { id: string; code: string }[];
  business: { name: string; currency_code: string; locale: string; timezone: string } | null;
  gaps: string[];
}) {
  const [state, action, pending] = useActionState(saveSetting, {});
  const onward = next === null ? '/dashboard' : `/onboarding/${next}`;

  return (
    <>
      {index === 1 ? (
        <p className="text-body-sm mt-6 rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
          You can skip any step. Anything you skip is listed on your dashboard until you fill it in,
          and costs that need it will say what is missing rather than guessing.
        </p>
      ) : null}

      <form action={action} className={`${CARD} mt-6`}>
        {step === 'business' ? (
          <>
            <input type="hidden" name="kind" value="business" />
            <h2 className="text-heading-sm text-text-primary">Your business</h2>
            <p className="text-body-sm mt-1 text-text-secondary">
              This sets how money and dates appear throughout the system.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Business name"
                name="name"
                defaultValue={business?.name ?? ''}
                placeholder="e.g. Bacani 3D Works"
                required
              />
              <Field
                label="Currency"
                name="currency_code"
                defaultValue={business?.currency_code ?? 'PHP'}
                readOnly
                helper="Used for every amount. It cannot be changed yet, because existing records carry no currency of their own and changing it would relabel them."
              />
              <Field
                label="Language and region"
                name="locale"
                defaultValue={business?.locale ?? 'en-PH'}
                required
              />
              <Field
                label="Time zone"
                name="timezone"
                defaultValue={business?.timezone ?? 'Asia/Manila'}
                required
              />
            </div>
          </>
        ) : null}

        {step === 'electricity' ? (
          <>
            <input type="hidden" name="kind" value="utility_rate" />
            <input type="hidden" name="utility_type" value="electricity" />
            <h2 className="text-heading-sm text-text-primary">Electricity rate</h2>
            <p className="text-body-sm mt-1 text-text-secondary">
              Machine time costs electricity. Enter the rate from your latest bill so production
              runs carry a real figure.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Rate per kilowatt-hour (₱)"
                name="rate_per_unit"
                type="number"
                step="any"
                min="0"
                helper="Use your total bill divided by total kWh used, not just the generation charge. Distribution, transmission, system loss and taxes all apply to the power a print consumes."
              />
              <label className="text-caption text-text-secondary">
                Unit
                <select name="unit_id" className={CONTROL}>
                  {energyUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Effective from"
                name="effective_from"
                type="date"
                defaultValue={TODAY}
                helper="Runs recorded before this date keep whatever rate applied then."
              />
              <Field
                label="Bill reference"
                name="source_reference"
                placeholder="e.g. Meralco August 2026"
                helper="So you can find where this number came from later."
              />
            </div>
          </>
        ) : null}

        {step === 'equipment' ? (
          <>
            <input type="hidden" name="kind" value="equipment" />
            <h2 className="text-heading-sm text-text-primary">Your equipment</h2>
            <p className="text-body-sm mt-1 text-text-secondary">
              Equipment wears out. Spreading its cost across the hours it runs means each product
              carries a share of it. Add the machine here, then set its hourly rate in Settings —
              the rate is a dated version, so it can change later without rewriting old runs.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Equipment name" name="name" placeholder="e.g. Bambu Lab P2S" required />
              <Field label="Category" name="category" />
              <Field
                label="Purchase price (₱)"
                name="purchase_price"
                type="number"
                step="any"
                min="0"
                required
              />
              <Field label="Purchase date" name="purchase_date" type="date" />
              <Field
                label="Average power draw (watts)"
                name="measured_avg_power_watts"
                type="number"
                step="any"
                min="0"
                helper="Measure this with a plug meter over one full print if you can. The rated figure on the box is peak draw with the bed and hotend both heating, which is not what a long print actually uses."
              />
            </div>
          </>
        ) : null}

        {step === 'labour' ? (
          <>
            <input type="hidden" name="kind" value="activity" />
            <h2 className="text-heading-sm text-text-primary">What your time is worth</h2>
            <p className="text-body-sm mt-1 text-text-secondary">
              Add the activities you actually do. You can add more later, and each gets its hourly
              rate in Settings.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Activity name" name="name" placeholder="e.g. Assembly" required />
              <label className="text-body-sm flex items-start gap-2 self-end pb-2 text-text-primary">
                <input
                  type="checkbox"
                  name="attended"
                  defaultChecked
                  className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span>
                  Your hands are occupied. On for work you are doing, off for time the machine runs
                  on its own — unattended time should not be charged at a full labour rate, or a
                  nine-hour print ends up priced like nine hours of work.
                </span>
              </label>
            </div>
          </>
        ) : null}

        {step === 'overhead' ? (
          <>
            <input type="hidden" name="kind" value="overhead_category" />
            <h2 className="text-heading-sm text-text-primary">Monthly running costs</h2>
            <p className="text-body-sm mt-1 text-text-secondary">
              Costs that keep the business going but do not belong to any one product: internet,
              software, workspace, tools. These are recovered across everything you sell. Add a
              category here, then set the amounts and your expected working hours in Settings, where
              the rate is computed and shown with its inputs.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Category name" name="name" placeholder="e.g. Workspace" required />
            </div>
          </>
        ) : null}

        {step === 'channels' ? (
          <>
            <input type="hidden" name="kind" value="channel" />
            <h2 className="text-heading-sm text-text-primary">Where you sell</h2>
            <p className="text-body-sm mt-1 text-text-secondary">
              Each channel takes a different cut. Recording them here means prices can account for
              it. Add the channel now and its fees in Settings, where they are dated versions.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Channel name" name="name" placeholder="e.g. Shopee" required />
            </div>
          </>
        ) : null}

        {state.error !== undefined ? (
          <p role="alert" className="text-body-sm mt-4 text-danger">
            {state.error}
          </p>
        ) : null}
        {state.saved === true ? (
          <p role="status" className="text-body-sm mt-4 text-success">
            Saved. Continue when you are ready.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          <Link
            href={onward as '/dashboard'}
            className="text-body-sm h-control-md inline-flex items-center rounded-control border border-border-control px-4 text-text-primary"
          >
            {state.saved === true ? 'Continue' : 'Skip for now'}
          </Link>
        </div>
      </form>

      {gaps.length > 0 ? (
        <p className="text-caption mt-4 text-text-tertiary">
          Still missing: {gaps.join(', ')}. Anything left will be listed on your dashboard.
        </p>
      ) : (
        <p className="text-caption mt-4 text-text-tertiary">
          Nothing is missing. Every cost can be worked out end to end.
        </p>
      )}
    </>
  );
}
