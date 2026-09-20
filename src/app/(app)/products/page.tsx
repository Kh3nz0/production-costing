import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { getProduct, getProductCost, listProducts } from '@/lib/products';
import { formatCalculationAmount, toDecimal } from '@/lib/decimal';
import { businessDate } from '@/lib/business-date';

export const metadata = { title: 'Products — Production Costing' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const org = await requireOrg();
  const query = await searchParams;
  const q = query.q?.trim() ?? '';
  const page =
    query.page && /^[1-9]\d*$/.test(query.page)
      ? Math.min(toDecimal(query.page).toNumber(), 10000)
      : 1;
  const { rows, count, error } = await listProducts(org.id, q, page);
  const today = businessDate(org.timezone);
  const productRows = await Promise.all(
    rows.map(async (row) => {
      const product = await getProduct(row.id, org.id);
      const cost = product ? await getProductCost(product, today) : null;
      return { ...row, cost };
    }),
  );
  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-text-primary">Products</h1>
          <p className="text-body mt-1 text-text-secondary">
            What you make and sell, and what each one costs you.
          </p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex h-control-md items-center rounded-control bg-accent px-4 text-body font-medium text-text-inverse hover:bg-accent-hover"
        >
          New product
        </Link>
      </div>
      <form method="get" className="mt-6 flex max-w-[520px] gap-2">
        <label className="sr-only" htmlFor="product-search">
          Search products
        </label>
        <input
          id="product-search"
          name="q"
          defaultValue={q}
          placeholder="Search name or SKU"
          className="h-field min-w-0 flex-1 rounded-control border border-border-control bg-surface px-3 text-body text-text-primary"
        />
        <button
          type="submit"
          className="rounded-control border border-border-strong bg-surface px-4 text-body-sm text-text-primary"
        >
          Search
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-body mt-6 text-danger">
          Could not load products. {error}
        </p>
      ) : rows.length === 0 ? (
        <section className="mt-6 rounded-card border border-border-strong bg-surface p-9 text-center">
          <h2 className="text-heading-sm text-text-primary">
            {q ? 'No products match that search' : 'No products yet'}
          </h2>
          <p className="text-body-sm mt-2 text-text-secondary">
            {q
              ? 'Try a different name or SKU.'
              : 'Add a product, then list what one unit consumes in its recipe.'}
          </p>
        </section>
      ) : (
        <div className="mt-6 overflow-hidden rounded-card border border-border-strong bg-surface">
          <div className="divide-y divide-border-strong lg:hidden">
            {productRows.map((row) => (
              <article key={row.id} className="p-5">
                <Link
                  href={`/products/${row.id}/recipe`}
                  className="text-body font-medium text-text-primary underline"
                >
                  {row.name}
                </Link>
                {row.variant_attributes?.label && (
                  <p className="text-caption text-text-secondary">{row.variant_attributes.label}</p>
                )}
                <p className="text-caption mt-2 text-text-secondary">{row.sku ?? 'No SKU'}</p>
                <p className="text-body-sm mt-3 text-text-primary">
                  Production cost:{' '}
                  {row.cost ? formatCalculationAmount(row.cost.displayInventory) : '—'}
                </p>
                <p
                  className={`text-caption mt-1 ${row.cost?.missing.length ? 'text-danger' : 'text-text-secondary'}`}
                >
                  {!row.cost
                    ? 'No recipe'
                    : row.cost.missing.length
                      ? `Incomplete cost · ${row.cost.missing.length} missing`
                      : 'Estimated'}
                </p>
                <Link
                  href={`/products/${row.id}/cost`}
                  className="text-body-sm mt-3 inline-block text-accent-text underline"
                >
                  Cost breakdown
                </Link>
              </article>
            ))}
          </div>
          <table className="hidden w-full text-left lg:table">
            <thead className="bg-surface-sunken">
              <tr>
                {['Product', 'Variant', 'SKU', 'Production cost', 'Status'].map((label) => (
                  <th key={label} scope="col" className="text-micro px-5 py-3 text-text-tertiary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => (
                <tr key={row.id} className="border-t border-border-strong">
                  <td className="px-5 py-3 text-body-sm text-text-primary">
                    <Link
                      href={`/products/${row.id}/recipe`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-body-sm text-text-secondary">
                    {row.variant_attributes?.label ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-body-sm text-text-secondary">{row.sku ?? '—'}</td>
                  <td className="px-5 py-3 text-body-sm tabular text-text-primary">
                    {row.cost ? (
                      <Link
                        href={`/products/${row.id}/cost`}
                        className="underline-offset-2 hover:underline"
                      >
                        {formatCalculationAmount(row.cost.displayInventory)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td
                    className={`px-5 py-3 text-body-sm ${row.cost?.missing.length ? 'text-danger' : 'text-text-secondary'}`}
                  >
                    {!row.cost
                      ? 'No recipe'
                      : row.cost.missing.length
                        ? `Incomplete cost · ${row.cost.missing.length} missing`
                        : 'Estimated'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {count > 20 && (
        <nav aria-label="Product pages" className="mt-4 flex gap-4 text-body-sm text-accent-text">
          {page > 1 && (
            <Link
              href={`/products?q=${encodeURIComponent(q)}&page=${page - 1}`}
              className="underline"
            >
              Previous
            </Link>
          )}
          <span className="text-text-secondary">
            Page {page} of {Math.ceil(count / 20)}
          </span>
          {page * 20 < count && (
            <Link
              href={`/products?q=${encodeURIComponent(q)}&page=${page + 1}`}
              className="underline"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
