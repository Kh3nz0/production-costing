import Link from 'next/link';

export function ProductTabs({ id, active }: { id: string; active: 'recipe' | 'cost' }) {
  return (
    <nav aria-label="Product" className="mt-6 flex flex-wrap gap-2">
      {(['recipe', 'cost'] as const).map((tab) => (
        <Link
          key={tab}
          href={`/products/${id}/${tab}`}
          aria-current={active === tab ? 'page' : undefined}
          className={`rounded-full px-4 py-2 text-body-sm ${active === tab ? 'bg-surface-accent font-medium text-accent-text' : 'bg-surface text-text-secondary hover:bg-surface-sunken'}`}
        >
          {tab === 'recipe' ? 'Recipe' : 'Cost'}
        </Link>
      ))}
    </nav>
  );
}
