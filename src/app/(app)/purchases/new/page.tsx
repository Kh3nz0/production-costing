import Link from 'next/link';
import { PurchaseForm } from './purchase-form';
import { requireOrg } from '@/lib/org';
import { listPurchasableItems, listSuppliers } from '@/lib/purchases';

export const metadata = { title: 'New purchase — Production Costing' };

export default async function NewPurchasePage() {
  await requireOrg();
  const [items, suppliers] = await Promise.all([listPurchasableItems(), listSuppliers()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <p className="text-caption text-text-tertiary">
        <Link href="/purchases" className="underline">
          Purchases
        </Link>
      </p>
      <h1 className="text-title mt-1 text-text-primary">New purchase</h1>
      <p className="text-body mt-1 max-w-[68ch] text-text-secondary">
        The unit cost of each item is worked out from what you paid, including its share of shipping
        and other added costs. Nothing reaches stock until you receive it.
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">No items to buy yet</p>
          <p className="text-body mt-1 text-text-secondary">
            A purchase line names an item, so add one first.
          </p>
          <Link
            href="/items/new"
            className="text-body-sm mt-4 inline-block text-accent-text underline"
          >
            New item
          </Link>
        </div>
      ) : (
        <PurchaseForm items={items} suppliers={suppliers} today={today} />
      )}
    </main>
  );
}
