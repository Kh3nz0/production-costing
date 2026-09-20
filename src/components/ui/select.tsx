import { useId, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  helper?: string;
  error?: string;
}

/**
 * A labelled select, matching `Field` exactly.
 *
 * F-29 found this missing in Figma — 22 fields whose value comes from a fixed
 * set were drawn as text inputs, so nothing told anyone a field was pickable.
 * The code had the same hole one step further on: every `<select>` was a raw
 * element with a hand-copied class string, which is how a control ends up with
 * a different height or border from the input beside it.
 *
 * The chevron is drawn rather than left to the platform, because the native one
 * differs between Safari, Chrome and Firefox and sits at a different inset in
 * each, which reads as three different controls on one form.
 */
export function Select({ label, helper, error, className = '', children, ...rest }: SelectProps) {
  const id = useId();
  const describedBy =
    error !== undefined ? `${id}-error` : helper !== undefined ? `${id}-help` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={id} className="text-caption text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error !== undefined || undefined}
          className={[
            'h-field w-full appearance-none rounded-control bg-surface pr-9 pl-3',
            'text-body text-text-primary',
            'border',
            error !== undefined ? 'border-danger' : 'border-border-strong',
            'transition-colors duration-fast ease-out',
            'disabled:bg-border disabled:text-text-tertiary',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 right-3 size-icon-sm -translate-y-1/2 text-text-secondary"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
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
