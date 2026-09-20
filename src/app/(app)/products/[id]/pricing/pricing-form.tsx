'use client';

import { useActionState } from 'react';
import { savePricingSnapshot, saveTargetMargin } from '../../actions';
import { Button } from '@/components/ui/button';
import type { ChannelWithFees } from '@/lib/products';

const CARD = 'rounded-card border border-border-strong bg-surface p-6';
const CONTROL =
  'h-field w-full rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary';

export function PricingForm({
  itemId,
  on,
  marginPercent,
  discountPercent,
  channels,
  canSnapshot,
}: {
  itemId: string;
  on: string;
  marginPercent: string;
  discountPercent: string;
  channels: ChannelWithFees[];
  canSnapshot: boolean;
}) {
  const [savedMargin, saveMargin, savingMargin] = useActionState(saveTargetMargin, {});
  const [snapshot, takeSnapshot, takingSnapshot] = useActionState(savePricingSnapshot, {});

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <form action={saveMargin} className={CARD}>
        <h2 className="text-heading-sm text-text-primary">Keep this target</h2>
        <p className="text-body-sm mt-1 text-text-secondary">
          Saving it means the figure above is there next time instead of being retyped.
        </p>
        <input type="hidden" name="item_id" value={itemId} />
        <label className="text-caption mt-4 block text-text-secondary">
          Target margin (%)
          <input
            name="target_margin_percent"
            type="number"
            step="any"
            min="0"
            defaultValue={marginPercent}
            className={CONTROL}
            required
          />
        </label>
        {savedMargin.error !== undefined ? (
          <p role="alert" className="text-body-sm mt-3 text-danger">
            {savedMargin.error}
          </p>
        ) : null}
        {savedMargin.saved === true ? (
          <p role="status" className="text-body-sm mt-3 text-success">
            Saved.
          </p>
        ) : null}
        <div className="mt-4">
          <Button type="submit" size="lg" disabled={savingMargin}>
            {savingMargin ? 'Saving…' : 'Save target margin'}
          </Button>
        </div>
      </form>

      <form action={takeSnapshot} className={CARD}>
        <h2 className="text-heading-sm text-text-primary">Save a pricing snapshot</h2>
        <p className="text-body-sm mt-1 text-text-secondary">
          Records today&rsquo;s cost, rates and price so you can tell a customer a figure and still
          know later what it assumed.
        </p>
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="on" value={on} />
        <input type="hidden" name="target_margin_percent" value={marginPercent} />
        <input type="hidden" name="discount_percent" value={discountPercent} />
        <label className="text-caption mt-4 block text-text-secondary">
          Channel
          <select name="channel_id" className={CONTROL} defaultValue="">
            <option value="">Direct</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-caption mt-4 block text-text-secondary">
          Note
          <input name="notes" className={CONTROL} />
        </label>
        {snapshot.error !== undefined ? (
          <p role="alert" className="text-body-sm mt-3 text-danger">
            {snapshot.error}
          </p>
        ) : null}
        {snapshot.saved === true ? (
          <p role="status" className="text-body-sm mt-3 text-success">
            Saved.
          </p>
        ) : null}
        <div className="mt-4">
          <Button type="submit" size="lg" disabled={takingSnapshot || !canSnapshot}>
            {takingSnapshot ? 'Saving…' : 'Save a pricing snapshot'}
          </Button>
        </div>
        {!canSnapshot ? (
          <p className="text-caption mt-2 text-text-tertiary">
            Enter a target margin above first: a snapshot records a price, and there is no price
            without one.
          </p>
        ) : null}
      </form>
    </div>
  );
}
