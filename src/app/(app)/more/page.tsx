import Link from 'next/link';
import {
  AdjustmentsHorizontalIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
  CubeIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { requireOrg } from '@/lib/org';

export const metadata = { title: 'More' };

/**
 * Everything the five tabs do not hold.
 *
 * The tab bar carries the four things done standing at a bench. These are the
 * ones done sitting down — and on a phone they are a list of large targets
 * rather than a second row of small icons.
 */
const DESTINATIONS = [
  {
    href: '/items',
    label: 'Items',
    description: 'Everything you buy, make or keep in stock.',
    icon: ArchiveBoxIcon,
  },
  {
    href: '/purchases',
    label: 'Purchases',
    description: 'What you bought and what it landed at.',
    icon: ShoppingBagIcon,
  },
  {
    href: '/products',
    label: 'Products',
    description: 'Recipes, costs and prices.',
    icon: CubeIcon,
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'Twelve reports, filtered by date and exportable.',
    icon: ChartBarIcon,
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Rates, channels, import and your business.',
    icon: AdjustmentsHorizontalIcon,
  },
] as const;

export default async function MorePage() {
  await requireOrg();
  return (
    <main className="mx-auto max-w-content-max px-4 py-9 lg:px-6">
      <h1 className="text-title text-text-primary">More</h1>
      <p className="text-body mt-1 text-text-secondary">Everything the tabs below do not hold.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {DESTINATIONS.map((destination) => (
          <li key={destination.href}>
            <Link
              href={destination.href}
              className="flex min-h-16 items-center gap-4 rounded-card border border-border-strong bg-surface px-5 py-4 hover:bg-surface-sunken"
            >
              <destination.icon className="size-icon-md shrink-0 text-text-secondary" aria-hidden />
              <span className="min-w-0">
                <span className="text-body block font-medium text-text-primary">
                  {destination.label}
                </span>
                <span className="text-body-sm block text-text-secondary">
                  {destination.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
