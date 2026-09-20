import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { getChannelsWithFees } from '@/lib/products';
import { listSellableItems } from '@/lib/runs';
import { businessDate } from '@/lib/business-date';
import { RecordSaleForm } from './record-sale-form';

export const metadata = { title: 'Record a sale — Production Costing' };

export default async function NewSalePage() {
  const org = await requireOrg();
  const today = businessDate(org.timezone);
  const [items, channels] = await Promise.all([
    listSellableItems(org.id),
    getChannelsWithFees(org.id, today),
  ]);

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <Link href="/sales" className="text-caption text-accent-text underline">
        Sales
      </Link>
      <h1 className="text-title mt-1 text-text-primary">Record a sale</h1>
      {items.length === 0 ? (
        <p className="text-body mt-6 rounded-card border border-border-strong bg-surface p-6 text-text-secondary">
          There is nothing to sell yet. A finished product appears here once it exists as an item.
        </p>
      ) : (
        <RecordSaleForm items={items} channels={channels} today={today} />
      )}
    </main>
  );
}
