import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

// Buttons carry no border: secondary is a filled surface, not an outline.
// docs/phase8-handoff.md section 3.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-text-inverse hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'bg-surface-sunken text-text-primary hover:bg-border-strong',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-sunken',
  danger: 'bg-danger text-text-inverse hover:bg-danger-hover',
};

const SIZES: Record<Size, string> = {
  sm: 'h-control-sm px-3 text-body-sm',
  md: 'h-control-md px-4 text-body',
  // 44px, the touch floor from size/touch-min. Mobile primary actions use it.
  lg: 'h-control-lg px-5 text-body',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-control font-medium',
        'transition-colors duration-[120ms] ease-out',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});
