import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary';
type Size = 'md' | 'lg' | 'responsive';

/**
 * A link that looks and measures like a button.
 *
 * Every primary action that navigates — Record a sale, Start a run, New item —
 * was hand-rolled from the same eight utility classes in twelve places, because
 * `Button` renders a `<button>` and these have to be anchors. Twelve copies is
 * twelve chances for one to drift, and four of them already had: two used
 * `text-white` instead of the inverse-text token, and eight sat at the 36px
 * medium height, below the 44px touch floor (WCAG 2.5.5).
 *
 * `responsive` is the default for a page's primary action: 44px where a thumb
 * has to hit it, 36px above `lg` where a cursor does.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-text-inverse hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'border border-border-strong bg-surface text-text-primary hover:bg-surface-sunken',
};

const SIZES: Record<Size, string> = {
  md: 'h-control-md px-4 text-body-sm',
  lg: 'h-control-lg px-5 text-body',
  responsive: 'h-control-lg px-5 text-body lg:h-control-md lg:px-4 lg:text-body-sm',
};

export function ButtonLink({
  variant = 'primary',
  size = 'responsive',
  className = '',
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      className={[
        'inline-flex items-center justify-center gap-2 rounded-control font-medium',
        'transition-colors duration-fast ease-out',
        VARIANTS[variant],
        SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
