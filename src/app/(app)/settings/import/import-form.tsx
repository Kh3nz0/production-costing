'use client';

import { useActionState, useState } from 'react';
import { applyUpload, validateUpload, type ImportState } from './actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { Template } from '@/lib/import-types';

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const CONTROL =
  'h-field w-full rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary';

export function ImportForm({ templates }: { templates: Template[] }) {
  const [checked, check, checking] = useActionState<ImportState, FormData>(validateUpload, {});
  const [applied, apply, applying] = useActionState<ImportState, FormData>(applyUpload, {});
  const [templateCode, setTemplateCode] = useState(templates[0]!.code);

  const template = templates.find((t) => t.code === templateCode)!;
  const ready =
    checked.csv !== undefined &&
    (checked.errors?.length ?? 0) === 0 &&
    applied.applied === undefined;

  return (
    <>
      <form action={check} className={`${CARD} mt-6`}>
        <h2 className="text-heading-sm text-text-primary">Check a file</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select
            label="Template"
            name="template_code"
            value={templateCode}
            onChange={(e) => setTemplateCode(e.target.value)}
          >
            {templates.map((option) => (
              <option key={option.code} value={option.code}>
                {option.order}. {option.code} — {option.title}
              </option>
            ))}
          </Select>
          <label className="text-caption text-text-secondary">
            CSV file
            <input type="file" name="file" accept=".csv,text/csv" className={`${CONTROL} pt-2`} />
          </label>
        </div>
        <p className="text-caption mt-2 text-text-tertiary">
          Creates {template.creates}.
          {template.dependsOn.length > 0
            ? ` Needs ${template.dependsOn.join(', ')} first.`
            : ' Depends on nothing else.'}
        </p>
        <div className="mt-4">
          <Button type="submit" size="lg" disabled={checking}>
            {checking ? 'Checking…' : 'Check the file'}
          </Button>
        </div>
      </form>

      {checked.orderError !== undefined ? (
        <p role="alert" className={`${CARD} mt-6 text-body text-danger`}>
          {checked.orderError}
        </p>
      ) : null}
      {checked.error !== undefined ? (
        <p role="alert" className={`${CARD} mt-6 text-body text-danger`}>
          {checked.error}
        </p>
      ) : null}

      {checked.totalRows !== undefined ? (
        <section className={`${CARD} mt-6`}>
          <h2 className="text-heading-sm text-text-primary">What would happen</h2>
          <dl className="mt-4 divide-y divide-border-subtle">
            {(
              [
                ['Rows in the file', String(checked.totalRows)],
                ['Would be created', String(checked.wouldCreate ?? 0)],
                ['Would be skipped', String(checked.wouldSkip ?? 0)],
                ['Errors', String(checked.errors?.length ?? 0)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-body-sm text-text-secondary">{label}</dt>
                <dd className="text-body-sm tabular-nums text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption mt-3 text-text-tertiary">
            Nothing has been written. Skipped rows are the example row each template ships with.
          </p>

          {(checked.errors?.length ?? 0) > 0 ? (
            <>
              <ul className="text-body-sm mt-4 list-disc pl-5 text-danger">
                {checked.errors!.slice(0, 10).map((error) => (
                  <li key={`${error.row}-${error.field}`}>{error.message}</li>
                ))}
              </ul>
              {checked.errors!.length > 10 ? (
                <p className="text-body-sm mt-2 text-text-secondary">
                  and {checked.errors!.length - 10} more, all of them in the file below.
                </p>
              ) : null}
              {checked.errorFile !== undefined ? (
                <a
                  download={`${checked.templateCode}-errors.csv`}
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(checked.errorFile)}`}
                  className="text-body-sm mt-4 inline-block text-accent-text underline"
                >
                  Download the rows that failed
                </a>
              ) : null}
              <p className="text-caption mt-2 text-text-tertiary">
                That file is the one you uploaded, with two columns added, so the fix happens in the
                spreadsheet you already have open.
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {ready ? (
        <form action={apply} className={`${CARD} mt-6`}>
          <input type="hidden" name="template_code" value={checked.templateCode ?? ''} />
          <input type="hidden" name="file_name" value={checked.fileName ?? ''} />
          <input type="hidden" name="csv" value={checked.csv ?? ''} />
          <h2 className="text-heading-sm text-text-primary">Apply it</h2>
          <p className="text-body-sm mt-1 text-text-secondary">
            Every row is checked again before anything is written, because a file can change between
            the check and the apply.
          </p>
          {checked.templateCode === '10-overhead' ? (
            <label className="text-caption mt-4 block max-w-form-sm text-text-secondary">
              Expected working hours per month
              <input
                name="expected_working_hours"
                type="number"
                step="any"
                min="0"
                required
                className={CONTROL}
              />
              <span className="text-caption mt-1 block text-text-tertiary">
                This template has a category, an amount and a date, and an overhead rate also needs
                the hours the pool is spread across. It is not in the file, so it is asked for here
                rather than guessed &mdash; a guessed denominator is a wrong rate on every product.
              </span>
            </label>
          ) : null}
          <div className="mt-4">
            <Button type="submit" size="lg" disabled={applying}>
              {applying ? 'Importing…' : `Import ${checked.wouldCreate ?? 0} rows`}
            </Button>
          </div>
        </form>
      ) : null}

      {applied.applied !== undefined ? (
        <p className={`${CARD} mt-6 text-body text-text-primary`}>
          {applied.applied} {applied.applied === 1 ? 'row' : 'rows'} imported.
        </p>
      ) : null}
      {applied.error !== undefined ? (
        <p role="alert" className={`${CARD} mt-6 text-body text-danger`}>
          {applied.error}
        </p>
      ) : null}
    </>
  );
}
