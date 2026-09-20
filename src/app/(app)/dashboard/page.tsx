import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { listItems } from '@/lib/items';

export const metadata = { title: 'Dashboard — Production Costing' };

export default async function DashboardPage() {
  const org = await requireOrg();
  const { rows } = await listItems();

  const uncosted = rows.filter((r) => r.avg_unit_cost === null).length;

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <p className="text-micro text-text-tertiary">Stage S2</p>
      <h1 className="text-title mt-1 text-text-primary">{org.name}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ['Items', String(rows.length), 'Everything you buy, make or keep in stock'],
          ['Without a cost yet', String(uncosted), 'A cost appears after the first purchase'],
          [
            'Currency',
            org.currency_code,
            org.vat_registered ? 'VAT registered' : 'Not VAT registered',
          ],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-card border border-border-strong bg-surface p-5">
            <p className="text-micro text-text-tertiary">{label}</p>
            <p className="text-value mt-1 text-text-primary">{value}</p>
            <p className="text-caption mt-1 text-text-secondary">{note}</p>
          </div>
        ))}
      </div>

      <p className="text-body mt-6">
        <Link href="/items" className="text-accent-text underline">
          Go to items
        </Link>
      </p>

      <p className="text-caption mt-6 max-w-[68ch] text-text-tertiary">
        The real dashboard is built at S10, after the reports that stand behind each of its figures
        exist. These three counts are readable straight from the items table, so they are honest
        now; nothing here is a placeholder figure.
      </p>
    </main>
  );
}
