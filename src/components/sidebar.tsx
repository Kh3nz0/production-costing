'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  AdjustmentsHorizontalIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CubeIcon,
  RectangleStackIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  TagIcon,
} from '@heroicons/react/24/outline';
import {
  AdjustmentsHorizontalIcon as AdjustmentsHorizontalSolid,
  ArchiveBoxIcon as ArchiveBoxSolid,
  ChartBarIcon as ChartBarSolid,
  Cog6ToothIcon as Cog6ToothSolid,
  CubeIcon as CubeSolid,
  RectangleStackIcon as RectangleStackSolid,
  ShoppingBagIcon as ShoppingBagSolid,
  Squares2X2Icon as Squares2X2Solid,
  TagIcon as TagSolid,
} from '@heroicons/react/24/solid';

/**
 * Desktop navigation, 240px.
 *
 * The current destination's icon switches to the HeroIcons **solid** set
 * (D-095). Weight, not only colour, marks position, so the current page
 * survives greyscale and colour-vision deficiency instead of relying on a blue
 * tint alone.
 *
 * Destinations that arrive in a later stage render as plain text rather than
 * links. That is deliberate rather than a placeholder: typed routes will not
 * compile a link to a route that does not exist, so this list cannot drift out
 * of step with what is actually built.
 */

type Built = { href: '/dashboard' | '/items'; stage?: never };
type Unbuilt = { href?: never; stage: string };

interface NavItem {
  label: string;
  outline: typeof Squares2X2Icon;
  solid: typeof Squares2X2Icon;
}

type Nav = NavItem & (Built | Unbuilt);

const OPERATE: Nav[] = [
  { label: 'Dashboard', href: '/dashboard', outline: Squares2X2Icon, solid: Squares2X2Solid },
  { label: 'Items', href: '/items', outline: ArchiveBoxIcon, solid: ArchiveBoxSolid },
  { label: 'Purchases', stage: 'S3', outline: ShoppingBagIcon, solid: ShoppingBagSolid },
  { label: 'Production', stage: 'S8', outline: Cog6ToothIcon, solid: Cog6ToothSolid },
  { label: 'Sales', stage: 'S9', outline: TagIcon, solid: TagSolid },
  { label: 'Inventory', stage: 'S4', outline: RectangleStackIcon, solid: RectangleStackSolid },
];

const UNDERSTAND: Nav[] = [
  { label: 'Products', stage: 'S6', outline: CubeIcon, solid: CubeSolid },
  { label: 'Reports', stage: 'S11', outline: ChartBarIcon, solid: ChartBarSolid },
];

const SETTINGS: Nav = {
  label: 'Settings',
  stage: 'S5',
  outline: AdjustmentsHorizontalIcon,
  solid: AdjustmentsHorizontalSolid,
};

function Item({ item, active }: { item: Nav; active: boolean }) {
  const Icon = active ? item.solid : item.outline;
  const inner = (
    <>
      <Icon className="size-icon-sm shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.href === undefined ? (
        <span className="text-micro ml-auto shrink-0 text-text-tertiary">{item.stage}</span>
      ) : null}
    </>
  );

  const shared = 'flex items-center gap-3 rounded-control px-3 py-2 text-body';

  if (item.href === undefined) {
    return (
      <span
        className={`${shared} cursor-default text-text-tertiary`}
        title={`Arrives at stage ${item.stage}`}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`${shared} transition-colors duration-[120ms] ease-out ${
        active
          ? 'bg-surface-accent font-medium text-accent-text'
          : 'text-text-secondary hover:bg-surface-sunken'
      }`}
    >
      {inner}
    </Link>
  );
}

function Group({ label, items, current }: { label: string; items: Nav[]; current: string | null }) {
  return (
    <>
      <p className="text-micro px-3 pt-4 pb-1 text-text-tertiary">{label}</p>
      {items.map((item) => (
        <Item
          key={item.label}
          item={item}
          active={
            item.href !== undefined &&
            current !== null &&
            (current === item.href || current.startsWith(`${item.href}/`))
          }
        />
      ))}
    </>
  );
}

export function Sidebar({ email }: { email: string }) {
  const current = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex w-sidebar shrink-0 flex-col border-r border-border-strong bg-surface px-3 py-4"
    >
      <span className="text-heading px-3 pb-2 text-brand-bloop">Bloop</span>

      <Group label="Operate" items={OPERATE} current={current} />
      <Group label="Understand" items={UNDERSTAND} current={current} />

      <div className="mt-auto pt-6">
        <Item item={SETTINGS} active={false} />
        <p className="text-caption truncate px-3 pt-2 text-text-tertiary" title={email}>
          {email}
        </p>
      </div>
    </nav>
  );
}
