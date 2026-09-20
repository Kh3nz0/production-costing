'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { reverseRun } from '../actions';
import { Field } from '@/components/ui/field';

export function ReverseRunForm({ runId }: { runId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(reverseRun, {});
  if (state.saved === true) router.refresh();

  return (
    <details className="mt-6 rounded-card border border-border-strong bg-surface p-6">
      <summary className="text-body-sm cursor-pointer text-text-secondary">
        This run should not have happened
      </summary>
      <p className="text-body-sm mt-3 text-text-secondary">
        A completed run is never edited. Reversing it writes the opposite of every movement it made,
        and leaves both the run and its reversal on the record — because &ldquo;this never
        happened&rdquo; and &ldquo;this happened and was undone&rdquo; are different facts, and only
        one of them is true.
      </p>
      <form action={action} className="mt-4 flex max-w-form-sm flex-col gap-3">
        <input type="hidden" name="run_id" value={runId} />
        <Field label="Reason" name="reason" required helper="Kept on every reversing movement." />
        {state.error !== undefined ? (
          <p role="alert" className="text-body-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="text-body-sm h-control-md self-start rounded-control border border-border-strong px-4 font-medium text-danger disabled:opacity-50"
        >
          {pending ? 'Reversing…' : 'Reverse this run'}
        </button>
      </form>
    </details>
  );
}
