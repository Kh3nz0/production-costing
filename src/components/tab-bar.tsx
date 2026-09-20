'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  TagIcon,
} from '@heroicons/react/24/outline';
import {
  Cog6ToothIcon as Cog6ToothSolid,
  EllipsisHorizontalIcon as EllipsisHorizontalSolid,
  RectangleStackIcon as RectangleStackSolid,
  Squares2X2Icon as Squares2X2Solid,
  TagIcon as TagSolid,
} from '@heroicons/react/24/solid';

/**
 * The phone's navigation: five destinations across the bottom, where a thumb
 * reaches. Shown below `lg`, where the 240px sidebar would take more than half
 * of a 390px screen (F-69).
 *
 * Five, not nine. The four things done standing at a bench — the dashboard, a
 * run, a sale, the stock — plus More for everything else. The current
 * destination switches to the solid icon, so position survives greyscale rather
 * than depending on a blue tint (D-095).
 *
 * Each target is 64px tall against WCAG 2.5.5's 44px, because this is used with
 * one hand while holding something in the other.
 */

const TABS = [
  { href: '/dashboard', label: 'Dashboard', outline: Squares2X2Icon, solid: Squares2X2Solid },
  { href: '/production', label: 'Production', outline: Cog6ToothIcon, solid: Cog6ToothSolid },
  { href: '/sales', label: 'Sales', outline: TagIcon, solid: TagSolid },
  {
    href: '/inventory',
    label: 'Inventory',
    outline: RectangleStackIcon,
    solid: RectangleStackSolid,
  },
  { href: '/more', label: 'More', outline: EllipsisHorizontalIcon, solid: EllipsisHorizontalSolid },
] as const;

type TabHref = (typeof TABS)[number]['href'];

export function TabBar() {
  const current = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="shrink-0 border-t border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = current === tab.href || current.startsWith(`${tab.href}/`);
          const Icon = active ? tab.solid : tab.outline;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href as TabHref}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 ${
                  active ? 'font-medium text-accent-text' : 'text-text-secondary'
                }`}
              >
                <Icon className="size-icon-md shrink-0" aria-hidden />
                <span className="text-micro">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
