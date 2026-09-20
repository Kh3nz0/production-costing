import type { StockStatus } from '@/lib/item-types';

interface Tone {
  dot: string;
  text: string;
  bg: string;
}

/**
 * A status badge is a dot plus a word, never colour alone.
 *
 * The dot uses the bright `-fill` token and the word uses the darker sibling,
 * because the bright hues sit below 4.5:1 and fail as small text.
 *
 * A switch rather than a lookup table so the compiler proves every status is
 * handled, instead of a missing key becoming an undefined class at runtime.
 */
function toneFor(status: StockStatus): Tone {
  switch (status) {
    case 'in_stock':
      return { dot: 'bg-success-fill', text: 'text-success', bg: 'bg-success-subtle' };
    case 'low':
      return { dot: 'bg-warning-fill', text: 'text-warning', bg: 'bg-warning-subtle' };
    case 'out_of_stock':
      return { dot: 'bg-danger-fill', text: 'text-danger', bg: 'bg-danger-subtle' };
    case 'no_cost':
    case 'archived':
      return { dot: 'bg-text-tertiary', text: 'text-text-secondary', bg: 'bg-surface-sunken' };
  }
}

export function StatusBadge({ status, label }: { status: StockStatus; label: string }) {
  const tone = toneFor(status);
  return (
    <span
      className={`text-caption inline-flex items-center gap-2 rounded-pill px-2 py-1 ${tone.bg} ${tone.text}`}
    >
      <span className={`size-1.5 shrink-0 rounded-pill ${tone.dot}`} aria-hidden />
      {label}
    </span>
  );
}
