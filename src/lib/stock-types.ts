/** Client-safe stock vocabulary. */

export const MOVEMENT_LABEL = {
  opening_balance: 'Opening balance',
  purchase_received: 'Purchase received',
  production_consumption: 'Used in production',
  production_output: 'Produced',
  production_failure: 'Production failure',
  waste: 'Waste',
  sale: 'Sold',
  customer_return: 'Customer return',
  supplier_return: 'Supplier return',
  damage: 'Damaged',
  adjustment: 'Adjustment',
} as const;

export type MovementType = keyof typeof MOVEMENT_LABEL;

export function movementLabel(type: MovementType): string {
  return MOVEMENT_LABEL[type];
}

/**
 * The four options the Adjust stock screen offers, and the movement type each
 * records.
 *
 * Three of them record an `adjustment`. That is deliberate rather than lazy: the
 * ledger distinguishes a real loss of goods from a correction of the record,
 * because the failures-and-waste report needs that line drawn. A stock count, a
 * correction and an "other" are all corrections of the record, and the reason
 * field carries the specifics.
 */
export const ADJUSTMENT_KINDS = [
  {
    value: 'count',
    label: 'Stock count',
    movementType: 'adjustment',
    help: 'The shelf and the system disagree, and the shelf is right.',
  },
  {
    value: 'damage',
    label: 'Damage',
    movementType: 'damage',
    help: 'Goods broken or spoiled. Recorded as a loss, not a correction.',
  },
  {
    value: 'waste',
    label: 'Waste',
    movementType: 'waste',
    help: 'Thrown away. Also a loss.',
  },
  {
    value: 'correction',
    label: 'Correction',
    movementType: 'adjustment',
    help: 'An earlier entry was wrong.',
  },
] as const;

export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number]['value'];

export function movementTypeFor(kind: string): MovementType | null {
  const found = ADJUSTMENT_KINDS.find((k) => k.value === kind);
  return found === undefined ? null : found.movementType;
}
