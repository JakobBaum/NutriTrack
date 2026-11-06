import { NutritionFacts, RecipeIngredient, RecipeOrigin } from '../core/models';
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

/** Auswahl beim Loggen: so viele Portionen werden gegessen (Hälften gehören zum Essen, nicht zur Ergiebigkeit). */
export const EAT_PORTION_OPTIONS: readonly number[] = [0.5, 1, 1.5, 2];

/** „Ergibt“ eines Rezepts: mindestens 1, ganze oder halbe Portionen. */
export function isValidYield(servings: number | null | undefined): servings is number {
  return typeof servings === 'number' && Number.isFinite(servings) && servings >= 1 && Number.isInteger(servings * 2);
}

/** Skaliert je-Portion-Nährwerte auf eine gegessene Portionszahl (immutabel). */
export function scaleFacts(facts: NutritionFacts, portions: number): NutritionFacts {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const opt = (v: number | undefined) => (v === undefined ? undefined : r1(v * portions));
  return {
    ...facts,
    kcal: Math.round(facts.kcal * portions),
    proteinG: r1(facts.proteinG * portions),
    carbsG: r1(facts.carbsG * portions),
    fatG: r1(facts.fatG * portions),
    fiberG: opt(facts.fiberG),
    sugarG: opt(facts.sugarG),
    saltG: opt(facts.saltG),
  };
}

/**
 * Optionaler Nährwert als Text: „keine Angabe“, wenn er fehlt oder wegen
 * fehlender Zutatenwerte nur 0 ist, sonst „12,5 g“.
 */
export function optionalGramsLabel(value: number | undefined, missingCount: number): string {
  if (value === undefined || (value === 0 && missingCount > 0)) return 'keine Angabe';
  return `${String(Math.round(value * 10) / 10).replace('.', ',')} g`;
}

/** Einmalige Erklärung statt „≥“ an jeder Zahl; leer, wenn nichts fehlt. */
export function lowerBoundNote(missingCount: number): string {
  return missingCount > 0 ? `≥ Mindestwerte: ${missingFactsLabel(missingCount)}` : '';
}

/** True, wenn die Einheit nicht in der Auswahlliste steht (Import-Prüfung). */
export function isUnknownUnit(unit: string, options: readonly string[]): boolean {
  return !!unit.trim() && !options.includes(unit);
}

/** Häufige Einheiten als 1-Tipp-Chips neben der Auswahl. */
export const QUICK_UNITS: readonly string[] = ['g', 'ml', 'EL', 'TL', 'Stk'];
