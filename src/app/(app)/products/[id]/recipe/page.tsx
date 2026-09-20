import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { getProduct, getProductCost, getRecipeOptions } from '@/lib/products';
import { formatCalculationAmount } from '@/lib/decimal';
import { RecipeForm } from './recipe-form';
import { ProductTabs } from '../product-tabs';
import { businessDate } from '@/lib/business-date';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const product = await getProduct(id, org.id);
  if (!product) notFound();
  const [options, cost] = await Promise.all([
    getRecipeOptions(org.id),
    getProductCost(product, businessDate(org.timezone)),
  ]);
  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <Link href="/products" className="text-caption text-accent-text underline">
        Products
      </Link>
      <h1 className="text-title mt-1 text-text-primary">{product.name}</h1>
      <p className="text-body mt-1 text-text-secondary">
        Everything that goes into one unit. Also called a bill of materials.
      </p>
      <ProductTabs id={id} active="recipe" />
      {product.bom && (
        <p className="text-caption mt-5 text-text-tertiary">
          Recipe revision {product.bom.revision_no}
          {product.bom.locked_at
            ? ' · Locked by a completed run. Saving creates a new revision.'
            : ' · Changes to this revision are saved in place until a run uses it.'}
        </p>
      )}
      <div className="mt-6">
        <RecipeForm
          productId={id}
          lines={product.lines}
          notes={product.bom?.notes ?? null}
          options={options}
        />
      </div>
      {cost && (
        <section className="mt-7 rounded-card border border-border-strong bg-surface p-6">
          <h2 className="text-heading-sm text-text-primary">Current estimate</h2>
          {cost.missing.length > 0 && (
            <p className="text-body-sm mt-2 text-danger">
              Incomplete: {cost.missing.length} inputs missing.
            </p>
          )}
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <p className="text-body-sm text-text-secondary">
              Production cost per unit
              <br />
              <strong className="text-heading text-text-primary">
                {formatCalculationAmount(cost.displayInventory)}
              </strong>
            </p>
            <p className="text-body-sm text-text-secondary">
              Full cost with overhead
              <br />
              <strong className="text-heading text-text-primary">
                {formatCalculationAmount(cost.displayFull)}
              </strong>
            </p>
          </div>
          <Link
            href={`/products/${id}/cost`}
            className="text-body-sm mt-4 inline-block text-accent-text underline"
          >
            See every input
          </Link>
        </section>
      )}
    </main>
  );
}
