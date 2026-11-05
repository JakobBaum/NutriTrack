import { RecipeIngredient, RecipeOrigin } from '../core/models';

/** Gramm je Einheit; EL, TL, Stk … sind Näherungswerte. */
export const UNIT_WEIGHT_G: Readonly<Record<string, number>> = {
  g: 1, kg: 1000, ml: 1, l: 1000,
  EL: 15, TL: 5, Prise: 0.5,
  Stk: 80, Pck: 100, Dose: 400, Bund: 50,
};

/** Einheiten mit exaktem Gewicht (kein „≈“ nötig). */
const EXACT_UNITS = new Set(['g', 'kg', 'ml', 'l']);

/** Näherungseinheiten samt Gramm-Wert, für die ausklappbare Erklärung. */
export const APPROX_UNITS: readonly { unit: string; g: number }[] = Object.entries(UNIT_WEIGHT_G)
  .filter(([unit]) => !EXACT_UNITS.has(unit))
  .map(([unit, g]) => ({ unit, g }));

/** Gesamtgewicht der Zutaten in Gramm (Näherung bei EL, TL, Stk …). */
export function totalWeightG(ingredients: readonly Pick<RecipeIngredient, 'amount' | 'unit'>[]): number {
  return Math.round(
    ingredients.reduce((sum, i) => sum + i.amount * (UNIT_WEIGHT_G[i.unit] ?? 0), 0),
  );
}

/** True, wenn mindestens eine Zutat eine Näherungseinheit nutzt. */
export function hasApproxUnits(ingredients: readonly Pick<RecipeIngredient, 'unit'>[]): boolean {
  return ingredients.some((i) => !EXACT_UNITS.has(i.unit));
}

/** Anzahl Zutaten ohne hinterlegte Nährwerte (zählen in der Summe als 0). */
export function countMissingFacts(ingredients: readonly Pick<RecipeIngredient, 'facts'>[]): number {
  return ingredients.filter((i) => !i.facts).length;
}

/** „1 Zutat ohne Werte“ / „2 Zutaten ohne Werte“. */
export function missingFactsLabel(count: number): string {
  return `${count} ${count === 1 ? 'Zutat' : 'Zutaten'} ohne Werte`;
}

/** Präfix „≥ “, wenn die Summe wegen fehlender Zutatenwerte nur eine Untergrenze ist. */
export function lowerBoundPrefix(missingCount: number): string {
  return missingCount > 0 ? '≥ ' : '';
}

/** True, wenn die Werte des Rezepts aus einem KI-Import stammen. */
export function isAiOrigin(origin: RecipeOrigin | undefined): boolean {
  return origin !== undefined && origin !== 'own';
}
