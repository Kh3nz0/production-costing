import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listMakeableProducts } from '@/lib/runs';
import { StartRunForm } from './start-run-form';

export const metadata = { title: 'Start a production run — Production Costing' };

export default async function StartRunPage() {
  const org = await requireOrg();
  const products = await listMakeableProducts(org.id);

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <Link href="/production" className="text-caption text-accent-text underline">
        Production
      </Link>
      <h1 className="text-title mt-1 text-text-primary">Start a production run</h1>
      {products.length === 0 ? (
        <p className="text-body mt-6 rounded-card border border-border-strong bg-surface p-6 text-text-secondary">
          No product has an active recipe yet, so there is nothing to make.{' '}
          <Link href="/products" className="text-accent-text underline">
            Build a recipe first.
          </Link>
        </p>
      ) : (
        <StartRunForm products={products} />
      )}
    </main>
  );
}
