import { toDecimal, type Decimal, type Numeric } from '@/lib/decimal';

export interface RecipeUnit {
  id: string;
  code: string;
  dimension_code: string;
  factor_to_dimension_base: string;
}

export interface RecipeItemUnits {
  name: string;
  base_unit_id: string;
  purchase_unit_id: string | null;
  purchase_to_base_factor: string | null;
}

/** F-04, also enforced by convert_to_base during recipe saves. All inputs
 * arrive through ::text projections, including item-specific pack factors. */
export function recipeQuantityInBase(
  item: RecipeItemUnits,
  quantity: Numeric,
  fromUnitId: string,
  units: RecipeUnit[],
): Decimal {
  const from = units.find((unit) => unit.id === fromUnitId);
  const base = units.find((unit) => unit.id === item.base_unit_id);
  if (!from || !base) throw new Error(`A unit is missing for ${item.name}.`);
  const qty = toDecimal(quantity);
  if (from.id === base.id) return qty;
  if (from.id === item.purchase_unit_id && item.purchase_to_base_factor !== null)
    return qty.times(toDecimal(item.purchase_to_base_factor));
  if (from.dimension_code === base.dimension_code)
    return qty
      .times(toDecimal(from.factor_to_dimension_base))
      .div(toDecimal(base.factor_to_dimension_base));
  throw new Error(`There is no conversion between ${from.code} and ${base.code} for ${item.name}.`);
}
