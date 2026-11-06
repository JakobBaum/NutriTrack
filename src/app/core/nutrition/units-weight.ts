import { RecipeIngredient } from '../models';

/** Gramm je Einheit; EL, TL, Stk … sind Näherungswerte. */
export const UNIT_WEIGHT_G: Readonly<Record<string, number>> = {
  g: 1, kg: 1000, ml: 1, l: 1000,
  EL: 15, TL: 5, Prise: 0.5,
  Stk: 80, Pck: 100, Dose: 400, Bund: 50,
};

/** Anzahl Zutaten ohne hinterlegte Nährwerte (zählen in der Summe als 0). */
export function countMissingFacts(ingredients: readonly Pick<RecipeIngredient, 'facts'>[]): number {
  return ingredients.filter((i) => !i.facts).length;
}
