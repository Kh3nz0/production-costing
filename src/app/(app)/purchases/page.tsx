import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button-link';
import { requireOrg } from '@/lib/org';
import { listPurchases } from '@/lib/purchases';
import { PURCHASE_STATUS_LABEL } from '@/lib/purchase-types';
import { Money } from '@/lib/money';

export const metadata = { title: 'Purchases — Production Costing' };

export default async function PurchasesPage() {
  await requireOrg();
  const { rows, error } = await listPurchases();

  const extrasOf = (r: (typeof rows)[number]): Money =>
    Money.fromCentavos(BigInt(r.supplier_shipping_cents))
      .plus(Money.fromCentavos(BigInt(r.duties_cents)))
      .plus(Money.fromCentavos(BigInt(r.other_landed_cost_cents)))
      .minus(Money.fromCentavos(BigInt(r.discount_cents)));

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">Purchases</h1>
          <p className="text-body mt-1 text-text-secondary">
            What you bought, what it cost you, and what that made each item worth.
          </p>
        </div>
        <ButtonLink href="/purchases/new">New purchase</ButtonLink>
      </div>

      {error !== null ? (
        <p role="alert" className="text-body mt-6 text-danger">
          Could not load your purchases. {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <p className="text-heading-sm text-text-primary">No purchases yet</p>
          <p className="text-body mt-1 text-text-secondary">
            Record what you bought and each item&rsquo;s unit cost is worked out from it, including
            its share of shipping.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border-strong bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="bg-surface-sunken">
                {['Date', 'Supplier', 'Reference', 'Added costs', 'Status'].map((h) => (
                  <th key={h} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border-strong">
                  <td className="px-5 py-3">
                    <Link
                      href={`/purchases/${row.id}`}
                      className="text-body-sm tabular text-text-primary underline-offset-2 hover:underline"
                    >
                      {row.purchase_date}
                    </Link>
                  </td>
                  <td className="text-body-sm px-5 py-3 text-text-secondary">
                    {row.supplier?.name ?? '—'}
                  </td>
                  <td className="text-mono-sm px-5 py-3 text-text-tertiary">
                    {row.reference_no ?? '—'}
                  </td>
                  <td className="text-body-sm tabular px-5 py-3 text-text-secondary">
                    {extrasOf(row).format()}
                  </td>
                  <td className="text-body-sm px-5 py-3">
                    <span
                      className={row.status === 'received' ? 'text-success' : 'text-text-secondary'}
                    >
                      {PURCHASE_STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
