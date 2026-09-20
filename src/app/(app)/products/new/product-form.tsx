'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProduct } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import type { UnitOption } from '@/lib/item-types';

export function ProductForm({ units }: { units: UnitOption[] }) {
  const [state, action, pending] = useActionState(createProduct, {});
  return (
    <form action={action} className="mt-6 max-w-form-lg space-y-6">
      <section className="rounded-card border border-border-strong bg-surface p-6">
        <h2 className="text-heading-sm text-text-primary">Product</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Product name" name="name" required placeholder="e.g. Clickable Keychain" />
          <Field
            label="Variant"
            name="variant"
            placeholder="e.g. 3-switch, black"
            helper="Optional. Names this version of the product."
          />
          <Field label="SKU or internal code" name="sku" />
          <label className="flex flex-col gap-1 text-caption text-text-secondary">
            Finished unit
            <select
              name="base_unit_id"
              required
              defaultValue=""
              className="h-field rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
            >
              <option value="">Choose a unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Units normally made per run"
            name="output_qty"
            type="number"
            min="0"
            step="any"
            helper="Used to estimate a batch."
          />
          <div className="sm:col-span-2">
            <Field label="Description" name="description" />
          </div>
        </div>
      </section>
      <section className="rounded-card border border-border-strong bg-surface p-6">
        <h2 className="text-heading-sm text-text-primary">Cost and price assumptions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Expected failure rate (%)"
            name="failure_percent"
            type="number"
            min="0"
            max="99.9999"
            step="any"
            helper="Leave blank if you do not know yet. Expected failures spread the work cost across good units."
          />
          <Field
            label="Target margin (%)"
            name="target_margin_percent"
            type="number"
            min="0"
            max="99.9999"
            step="any"
          />
          <Field
            label="Minimum acceptable margin (%)"
            name="minimum_margin_percent"
            type="number"
            min="0"
            max="99.9999"
            step="any"
          />
        </div>
      </section>
      {state.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save and add recipe'}
        </Button>
        <Link href="/products" className="text-body-sm text-text-secondary underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
