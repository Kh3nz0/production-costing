/** Client-safe stock vocabulary. */

import { formatExactRate, formatQuantity, formatRate, toDecimal } from './decimal';
import { Money } from './money';

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

/**
 * The readout under the opening-balance form: what the quantity and the unit
 * cost multiply to.
 *
 * It exists because an opening balance cannot be corrected. It is only valid as
 * an item's first movement, so a mistyped unit cost costs you the item - you
 * archive it and build it again. ₱50.00 and ₱2.50 look alike in a number field
 * and not at all alike as ₱2,500.00 against ₱125.00.
 *
 * Every input can be empty, half-typed or nonsense while someone types, and
 * that is the state that crashed the purchase preview (F-43). Anything that
 * does not parse returns null, which the form renders as nothing at all.
 */
export function openingBalanceValue(
  qty: string,
  unitCost: string,
  unitCode: string | null,
): string | null {
  if (qty.trim() === '' || unitCost.trim() === '') return null;
  try {
    const quantity = toDecimal(qty);
    const cost = toDecimal(unitCost);
    if (quantity.isNegative() || cost.isNegative()) return null;
    // Echo the cost as it was typed. The usual rate formatter stops at two
    // places above ₱1.00, which would print a typed ₱1.115 as ₱1.12 beside a
    // total computed from ₱1.115 - three numbers on one line that do not
    // multiply. Below two places it still pads, so ₱2.50 does not read ₱2.5.
    const rate = cost.decimalPlaces() > 2 ? formatExactRate(cost) : formatRate(cost);
    return `${formatQuantity(quantity, unitCode ?? undefined)} × ${rate} = ${Money.fromDecimal(quantity.times(cost)).format()}`;
  } catch {
    return null;
  }
}
