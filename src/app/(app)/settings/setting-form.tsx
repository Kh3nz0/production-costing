'use client';

import { useActionState } from 'react';
import { saveSetting, type SettingsState } from './actions';

export function SettingForm({
  kind,
  title,
  children,
}: {
  kind: string;
  title: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSetting, {});
  return (
    <form action={action} className="rounded-card border border-border-strong bg-surface p-6">
      <input type="hidden" name="kind" value={kind} />
      <h2 className="text-heading-sm mb-4 text-text-primary">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      {state.error && (
        <p role="alert" className="text-body-sm mt-4 text-danger">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p role="status" className="text-body-sm mt-4 text-success">
          Saved.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-body-sm mt-5 rounded-control bg-accent px-4 py-2 font-medium text-text-inverse disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
