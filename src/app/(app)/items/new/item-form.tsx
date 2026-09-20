'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createItem, type ActionState } from '../../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ITEM_TYPES, itemTypeLabel, type UnitOption } from '@/lib/item-types';

const initial: ActionState = {};

function Select({
  label,
  name,
  helper,
  children,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  helper?: string;
  children: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={name} className="text-caption text-text-secondary">
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        value={value}
        onChange={onChange === undefined ? undefined : (e) => onChange(e.target.value)}
        className="h-field w-full rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
      >
        {children}
      </select>
      {helper !== undefined ? <p className="text-caption text-text-tertiary">{helper}</p> : null}
    </div>
  );
}

export function ItemForm({ units }: { units: UnitOption[] }) {
  const [state, action, pending] = useActionState(createItem, initial);
  const [baseUnit, setBaseUnit] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('');

  // The factor only means something when the two units differ. Showing it
  // otherwise invites a value that does nothing.
  const needsFactor = purchaseUnit !== '' && purchaseUnit !== baseUnit;

  return (
    <form action={action} className="mt-6 flex max-w-[760px] flex-col gap-6">
      <section className="rounded-card border border-border-strong bg-surface p-6">
        <h2 className="text-micro text-text-tertiary">What it is</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            name="name"
            placeholder="e.g. PLA Basic Filament"
            autoFocus
            required
          />
          <Select
            label="Type"
            name="item_type"
            required
            helper="This decides where the item appears and how it can be used. A subassembly is something you make and then use inside something else."
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {itemTypeLabel(t)}
              </option>
            ))}
          </Select>
          <Field label="SKU or internal code" name="sku" helper="Optional. Must be unique." />
          <Field label="Brand" name="brand" />
          <Field label="Colour" name="colour" />
          <Field label="Description" name="description" />
        </div>
      </section>

      <section className="rounded-card border border-border-strong bg-surface p-6">
        <h2 className="text-micro text-text-tertiary">Units</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select
            label="Unit you consume it in"
            name="base_unit_id"
            required
            value={baseUnit}
            onChange={setBaseUnit}
            helper="The unit you use when building a recipe. Grams for filament, pieces for switches, millimetres for chain."
          >
            <option value="">Choose a unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.code})
              </option>
            ))}
          </Select>
          <Select
            label="Unit you buy it in"
            name="purchase_unit_id"
            value={purchaseUnit}
            onChange={setPurchaseUnit}
            helper="Leave the same if you buy and use it the same way."
          >
            <option value="">Same as above</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.code})
              </option>
            ))}
          </Select>
          {needsFactor ? (
            <div className="sm:col-span-2">
              <Field
                label="How much of the consuming unit is in one buying unit"
                name="purchase_to_base_factor"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 1000"
                required
                helper="A 1 kg filament spool holds 1000 g, so enter 1000. A 750 g spool is 750. A pack of 90 switches is 90. Getting this wrong is the most common cause of a wrong material cost."
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-card border border-border-strong bg-surface p-6">
        <h2 className="text-micro text-text-tertiary">Stock</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Reorder at"
            name="reorder_point"
            type="number"
            step="any"
            min="0"
            helper="You will be warned when the quantity on hand falls to this level."
          />
          <Field
            label="Supplier lead time"
            name="supplier_lead_time_days"
            type="number"
            min="0"
            step="1"
            helper="In days."
          />
          <div className="sm:col-span-2">
            <Field label="Notes" name="notes" />
          </div>
        </div>
      </section>

      {state.error !== undefined ? (
        <p role="alert" className="text-caption text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : 'Save item'}
        </Button>
        <Link href="/items" className="text-body-sm text-text-secondary underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
