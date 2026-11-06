import { RecipeIngredient, RecipeOrigin } from '../core/models';
import { UNIT_WEIGHT_G, countMissingFacts } from '../core/nutrition/units-weight';

// Re-Export: Bestandsimporte (z. B. Diary) bleiben unverändert gültig.
export { UNIT_WEIGHT_G, countMissingFacts };

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

/** „1 Zutat ohne Werte“ / „2 Zutaten ohne Werte“. */
export function missingFactsLabel(count: number): string {
  return `${count} ${count === 1 ? 'Zutat' : 'Zutaten'} ohne Werte`;
}

/** „1 Portion“ / „4 Portionen“. */
export function servingsLabel(servings: number): string {
  const text = String(servings).replace('.', ',');
  return `${text} ${servings === 1 ? 'Portion' : 'Portionen'}`;
}

/** Präfix „≥ “, wenn die Summe wegen fehlender Zutatenwerte nur eine Untergrenze ist. */
export function lowerBoundPrefix(missingCount: number): string {
  return missingCount > 0 ? '≥ ' : '';
}

/** True, wenn die Werte des Rezepts aus einem KI-Import stammen. */
export function isAiOrigin(origin: RecipeOrigin | undefined): boolean {
  return origin !== undefined && origin !== 'own';
}
