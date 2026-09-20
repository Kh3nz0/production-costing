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
 * The outline is `border-strong` at 1px, by the owner's decision on 21
 * September 2026 (D-130), because that is what the Figma file specifies.
 *
 * This is a knowing accessibility regression and is recorded as one. The token
 * is #E3E8F0, which is 1.23:1 against the surface; WCAG 1.4.11 asks 3:1 of a
 * component boundary, and `border-control` at 3.44:1 was the only token that
 * cleared it. F-19 made exactly this change in the other direction and F-72
 * records it going back. If a field ever looks edgeless on a bright screen,
 * this is why, and one token is all it takes to reverse.
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
          error !== undefined ? 'border-danger' : 'border-border-strong',
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
