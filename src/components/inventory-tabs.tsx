import Link from 'next/link';

const TABS = [
  { href: '/inventory', label: 'On hand' },
  { href: '/inventory/movements', label: 'Movements' },
  { href: '/inventory/valuation', label: 'Valuation' },
] as const;

export function InventoryTabs({ current }: { current: (typeof TABS)[number]['href'] }) {
  return (
    <div className="mt-6 flex flex-wrap gap-1 border-b border-border-strong">
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`text-body px-4 py-2.5 transition-colors duration-fast ${
              active
                ? 'border-b-2 border-accent font-medium text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function InventoryHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-title text-text-primary">Inventory</h1>
        <p className="text-body mt-1 text-text-secondary">
          What is on hand, what it is worth, and everything that changed it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/inventory/adjust"
          className="text-body inline-flex h-control-md items-center rounded-control bg-surface-sunken px-4 text-text-primary transition-colors duration-fast hover:bg-border-strong"
        >
          Adjust stock
        </Link>
        <Link
          href="/inventory/adjust?mode=opening"
          className="text-body inline-flex h-control-md items-center rounded-control bg-accent px-4 font-medium text-text-inverse transition-colors duration-fast hover:bg-accent-hover"
        >
          Record opening balances
        </Link>
      </div>
    </div>
  );
}
