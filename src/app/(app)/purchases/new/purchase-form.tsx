'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createPurchase, type ActionState } from '../../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import {
  LANDED_COST_BASES,
  previewAllocation,
  type LandedCostBase,
  type PreviewLine,
} from '@/lib/purchase-types';
import type { PurchasableItem, SupplierOption } from '@/lib/purchases';

const initial: ActionState = {};

interface Row {
  key: string;
  itemId: string;
  qty: string;
  price: string;
  weight: string;
}

let nextKey = 0;
const blankRow = (): Row => ({
  key: `row-${(nextKey += 1)}`,
  itemId: '',
  qty: '',
  price: '',
  weight: '',
});

export function PurchaseForm({
  items,
  suppliers,
  today,
}: {
  items: PurchasableItem[];
  suppliers: SupplierOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createPurchase, initial);
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [base, setBase] = useState<LandedCostBase>('value');
  const [shipping, setShipping] = useState('');
  const [duties, setDuties] = useState('');
  const [other, setOther] = useState('');
  const [discount, setDiscount] = useState('');

  const itemById = new Map(items.map((i) => [i.id, i]));

  const update = (key: string, patch: Partial<Row>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // The preview runs on every keystroke, from the same Money.allocate the
  // receive path uses. A preview that disagreed with what gets saved would be
  // worse than no preview.
  const previewLines: PreviewLine[] = rows
    .filter((r) => r.itemId !== '' && r.qty !== '')
    .map((r) => {
      const item = itemById.get(r.itemId);
      return {
        key: r.key,
        label: item?.name ?? 'Item',
        qty: r.qty,
        unitPrice: r.price === '' ? '0' : r.price,
        weight: r.weight === '' ? null : r.weight,
        dimension: item?.purchase_unit?.dimension_code ?? item?.base_unit?.code ?? null,
        dimensionLabel: item?.purchase_unit?.name ?? item?.base_unit?.name ?? null,
        factorToBase: item?.purchase_to_base_factor ?? '1',
        baseUnitCode: item?.base_unit?.code ?? null,
      };
    });

  const preview = previewAllocation(base, { shipping, duties, other, discount }, previewLines);

  return (
    <form action={action} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <section className="rounded-card border border-border-strong bg-surface p-6">
          <h2 className="text-micro text-text-tertiary">Purchase details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex w-full flex-col gap-1">
              <label htmlFor="supplier_id" className="text-caption text-text-secondary">
                Supplier
              </label>
              <select
                id="supplier_id"
                name="supplier_id"
                className="h-field w-full rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
              >
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Purchase date"
              name="purchase_date"
              type="date"
              defaultValue={today}
              required
            />
            <Field
              label="Reference number"
              name="reference_no"
              helper="Optional. Must be unique."
            />
          </div>
        </section>

        <section className="rounded-card border border-border-strong bg-surface p-6">
          <h2 className="text-micro text-text-tertiary">What you bought</h2>
          <div className="mt-4 flex flex-col gap-4">
            {rows.map((row) => {
              const item = itemById.get(row.itemId);
              return (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-control bg-surface-sunken p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  {/* Was a detached <label> with no htmlFor, so the control had
                      no accessible name at all — a critical axe violation, and
                      the reason the Select component exists (F-81). */}
                  <Select
                    label="Item"
                    name="line_item_id"
                    value={row.itemId}
                    onChange={(e) => update(row.key, { itemId: e.target.value })}
                  >
                    <option value="">Choose an item</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </Select>

                  <Field
                    label={`Quantity${item?.purchase_unit !== null && item?.purchase_unit !== undefined ? ` (${item.purchase_unit.code})` : ''}`}
                    name="line_qty"
                    type="number"
                    step="any"
                    min="0"
                    value={row.qty}
                    onChange={(e) => update(row.key, { qty: e.target.value })}
                  />
                  <Field
                    label="Price per unit"
                    name="line_price"
                    type="number"
                    step="any"
                    min="0"
                    value={row.price}
                    onChange={(e) => update(row.key, { price: e.target.value })}
                  />

                  <input type="hidden" name="line_unit_id" value={item?.purchase_unit?.id ?? ''} />
                  <input type="hidden" name="line_weight" value={row.weight} />

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((r) => (r.length === 1 ? r : r.filter((x) => x.key !== row.key)))
                      }
                      disabled={rows.length === 1}
                      className="text-body-sm h-control-md rounded-control px-3 text-text-secondary transition-colors duration-fast hover:bg-border-strong disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRows((r) => [...r, blankRow()])}
            >
              Add a line
            </Button>
          </div>
        </section>

        <section className="rounded-card border border-border-strong bg-surface p-6">
          <h2 className="text-micro text-text-tertiary">Added costs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Supplier shipping"
              name="supplier_shipping"
              type="number"
              step="any"
              min="0"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              helper="Charged by the supplier for delivery."
            />
            <Field
              label="Duties"
              name="duties"
              type="number"
              step="any"
              min="0"
              value={duties}
              onChange={(e) => setDuties(e.target.value)}
            />
            <Field
              label="Other costs"
              name="other_landed_cost"
              type="number"
              step="any"
              min="0"
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
            <Field
              label="Purchase discount"
              name="discount"
              type="number"
              step="any"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>

          <fieldset className="mt-5">
            <legend className="text-micro text-text-tertiary">How to spread added costs</legend>
            <div className="mt-3 flex flex-col gap-3">
              {LANDED_COST_BASES.map((option) => {
                const unavailable =
                  option.value !== 'value' &&
                  previewAllocation(option.value, {}, previewLines).baseError;
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 ${unavailable !== null && unavailable !== false ? 'text-text-tertiary' : 'text-text-primary'}`}
                  >
                    <input
                      type="radio"
                      name="landed_cost_base"
                      value={option.value}
                      checked={base === option.value}
                      disabled={unavailable !== null && unavailable !== false}
                      onChange={() => setBase(option.value)}
                      className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="text-body">{option.label}</span>
                      <span className="text-caption block text-text-secondary">
                        {unavailable !== null && unavailable !== false ? unavailable : option.help}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        {state.error !== undefined ? (
          <p role="alert" className="text-caption text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Saving…' : 'Save purchase'}
          </Button>
          <Link href="/purchases" className="text-body-sm text-text-secondary underline">
            Cancel
          </Link>
        </div>
      </div>

      <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
        <div className="rounded-card border border-border-strong bg-surface-accent p-5">
          <p className="text-micro text-accent-text">How added costs will be spread</p>
          <p className="text-value-sm tabular mt-1 text-text-primary">{preview.extras.format()}</p>

          {preview.baseError !== null ? (
            <p role="alert" className="text-caption mt-2 text-danger">
              {preview.baseError}
            </p>
          ) : preview.rows.length === 0 ? (
            <p className="text-caption mt-2 text-text-secondary">
              Add a line and the allocation appears here, before anything is saved.
            </p>
          ) : (
            <>
              <dl className="mt-3 flex flex-col gap-2">
                {preview.rows.map((row) => (
                  <div key={row.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-caption min-w-0 flex-1 truncate text-text-secondary">
                      {row.label}
                    </dt>
                    <dd className="text-caption tabular shrink-0 text-text-primary">
                      {row.allocated.format()}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-caption mt-3 border-t border-border-strong pt-3 text-text-secondary">
                {preview.reconciles
                  ? `Allocated ${preview.allocatedTotal.format()}, which matches exactly.`
                  : `Allocated ${preview.allocatedTotal.format()}, which does not match ${preview.extras.format()}.`}
              </p>
            </>
          )}
        </div>

        {preview.rows.length > 0 && preview.baseError === null ? (
          <div className="rounded-card border border-border-strong bg-surface p-5">
            <p className="text-micro text-text-tertiary">What each item will cost</p>
            <dl className="mt-3 flex flex-col gap-3">
              {preview.rows.map((row) => (
                <div key={row.key}>
                  <dt className="text-caption text-text-secondary">{row.label}</dt>
                  <dd className="text-body-sm tabular text-text-primary">
                    {row.unitCost === null ? '—' : `₱${row.unitCost} / ${row.baseUnitCode ?? ''}`}{' '}
                    <span className="text-caption ml-2 text-text-tertiary">
                      from {row.landedTotal.format()}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-caption mt-3 text-text-tertiary">
              Each share rounds to the centavo and the remainder goes to the largest line, so the
              allocations always reconcile to the total.
            </p>
          </div>
        ) : null}
      </aside>
    </form>
  );
}
