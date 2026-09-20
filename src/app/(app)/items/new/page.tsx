import Link from 'next/link';
import { ItemForm } from './item-form';
import { requireOrg } from '@/lib/org';
import { listUnits } from '@/lib/items';

export const metadata = { title: 'New item — Production Costing' };

export default async function NewItemPage() {
  await requireOrg();
  const units = await listUnits();

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <p className="text-caption text-text-tertiary">
        <Link href="/items" className="underline">
          Items
        </Link>
      </p>
      <h1 className="text-title mt-1 text-text-primary">New item</h1>
      <p className="text-body mt-1 max-w-[68ch] text-text-secondary">
        Unit cost is never typed. It is worked out from what you actually pay, including each
        purchase&rsquo;s share of shipping and other added costs.
      </p>
      <ItemForm units={units} />
    </main>
  );
}
