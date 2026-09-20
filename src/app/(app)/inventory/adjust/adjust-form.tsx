'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { adjustStock, recordOpeningBalance, type ActionState } from '../../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ADJUSTMENT_KINDS, openingBalanceValue } from '@/lib/stock-types';
import { formatQuantity, toDecimal } from '@/lib/decimal';

const initial: ActionState = {};

export interface AdjustableItem {
  id: string;
  name: string;
  qty_on_hand: string;
  unit_code: string | null;
  has_history: boolean;
}

export function AdjustForm({
  items,
  mode,
}: {
  items: AdjustableItem[];
  mode: 'adjust' | 'opening';
}) {
  const opening = mode === 'opening';
  const [state, action, pending] = useActionState(
    opening ? recordOpeningBalance : adjustStock,
    initial,
  );
  const [itemId, setItemId] = useState('');
  const [newQty, setNewQty] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const item = items.find((i) => i.id === itemId);
  const choices = opening ? items.filter((i) => !i.has_history) : items;

  // The readout the spec asks for: "Change: [+/−][qty] [unit]". Shown from the
  // current balance rather than typed, so the user states what is there and the
  // difference is derived.
  const openingValue = opening
    ? openingBalanceValue(newQty, unitCost, item?.unit_code ?? null)
    : null;

  let change: string | null = null;
  if (!opening && item !== undefined && newQty !== '') {
    try {
      const delta = toDecimal(newQty).minus(item.qty_on_hand);
      change = `${delta.isNegative() ? '−' : '+'}${formatQuantity(delta.abs(), item.unit_code ?? undefined)}`;
    } catch {
      change = null;
    }
  }

  // A picker holding nothing is a dead end: "Choose an item" promises a choice
  // that does not exist, and the reason sits below it as a footnote. Say it
  // instead, and name the two ways out.
  if (opening && choices.length === 0) {
    return (
      <div className="mt-6 flex max-w-form flex-col gap-4">
        <p className="text-body text-text-primary">
          Every item already has stock history, so none can take an opening balance. An opening
          balance is only valid as an item&rsquo;s first movement.
        </p>
        <p className="text-body-sm text-text-secondary">
          To give an item a cost from here, record a purchase. To start one over, archive it and
          create it again.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/purchases/new"
            className="text-body-sm text-text-primary font-medium underline"
          >
            Record a purchase
          </Link>
          <Link href="/inventory" className="text-body-sm text-text-secondary underline">
            Back to inventory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 flex max-w-form flex-col gap-4">
      <div className="flex w-full flex-col gap-1">
        <label htmlFor="item_id" className="text-caption text-text-secondary">
          Item
        </label>
        <select
          id="item_id"
          name="item_id"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          required
          className="h-field w-full rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary"
        >
          <option value="">Choose an item</option>
          {choices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {opening
                ? ''
                : ` — ${formatQuantity(i.qty_on_hand, i.unit_code ?? undefined)} on hand`}
            </option>
          ))}
        </select>
        {opening && choices.length < items.length ? (
          <p className="text-caption text-text-tertiary">
            Items with stock history are not listed: an opening balance would rewrite it. Adjust
            those instead.
          </p>
        ) : null}
      </div>

      {opening ? (
        <>
          <Field
            label="Quantity"
            name="qty"
            type="number"
            step="any"
            min="0"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            helper={
              item === null || item === undefined
                ? 'What is on the shelf.'
                : `What is on the shelf, in ${item.unit_code ?? 'base units'}.`
            }
            required
          />
          <Field
            label="Unit cost"
            name="unit_cost"
            type="number"
            step="any"
            min="0"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            helper="If you do not know what it cost, leave this blank. The item will show no unit cost until your next purchase, which is more honest than a guess."
          />

          {openingValue !== null ? (
            <p className="text-body-sm tabular rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
              {openingValue}
            </p>
          ) : null}
          <Field
            label="As of date"
            name="as_of"
            type="date"
            helper="Optional. Defaults to today."
          />
        </>
      ) : (
        <>
          <Field
            label="New quantity"
            name="new_qty"
            type="number"
            step="any"
            min="0"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            helper="What is actually there. The difference is recorded as an adjustment."
            required
          />

          {change !== null ? (
            <p className="text-body-sm tabular rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
              Change: {change}
            </p>
          ) : null}

          <fieldset>
            <legend className="text-caption text-text-secondary">Type</legend>
            <div className="mt-2 flex flex-col gap-2">
              {ADJUSTMENT_KINDS.map((kind, i) => (
                <label key={kind.value} className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="kind"
                    value={kind.value}
                    defaultChecked={i === 0}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="text-body text-text-primary">{kind.label}</span>
                    <span className="text-caption block text-text-secondary">{kind.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            label="Reason"
            name="reason"
            helper="Required. Future you will want to know why this number moved."
            required
          />
        </>
      )}

      {state.error !== undefined ? (
        <p role="alert" className="text-caption text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Recording…' : opening ? 'Record opening balance' : 'Record adjustment'}
        </Button>
        <Link href="/inventory" className="text-body-sm text-text-secondary underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
