import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listUnits } from '@/lib/items';
import { ProductForm } from './product-form';

export const metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requireOrg();
  const units = await listUnits();
  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <Link href="/products" className="text-caption text-accent-text underline">
        Products
      </Link>
      <h1 className="text-title mt-1 text-text-primary">New product</h1>
      <p className="text-body mt-1 text-text-secondary">
        Name what you make. The recipe records what one unit consumes.
      </p>
      <ProductForm units={units.filter((unit) => unit.dimension_code === 'count')} />
    </main>
  );
}
