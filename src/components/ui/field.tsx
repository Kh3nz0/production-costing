import { useId, type InputHTMLAttributes } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the field. Replaced by `error` when there is one. */
  helper?: string;
  error?: string;
}

/**
 * A labelled input. The label is persistent rather than a placeholder, because a
 * placeholder disappears exactly when the user needs it, and the helper always
 * wraps rather than truncating (D-077).
 *
 * The outline is `border-control` at 1px: WCAG 1.4.11 asks 3:1 of a component
 * boundary and it is the only border token that clears it. Never `border-strong`
 * here — the field would have no visible edge (F-19).
 */
export function Field({ label, helper, error, className = '', ...rest }: FieldProps) {
  const id = useId();
  const describedBy =
    error !== undefined ? `${id}-error` : helper !== undefined ? `${id}-help` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={id} className="text-caption text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined || undefined}
        className={[
          'h-field w-full rounded-control bg-surface px-3 text-body text-text-primary',
          'border',
          error !== undefined ? 'border-danger' : 'border-border-control',
          'placeholder:text-text-tertiary',
          'transition-colors duration-fast ease-out',
          'disabled:bg-border disabled:text-text-tertiary',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {error !== undefined ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : helper !== undefined ? (
        <p id={`${id}-help`} className="text-caption text-text-tertiary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
