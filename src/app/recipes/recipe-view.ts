import { STATE_MESSAGES } from '../core/messages/state-messages';
import { NutritionFacts, Recipe, RecipeIngredient, RecipeOrigin } from '../core/models';
import { hasNutrition, perServingFacts, reconcileKcal } from '../core/nutrition/recipe-nutrition';
import { UNIT_WEIGHT_G, canonicalUnitKey, countMissingFacts, unitGrams } from '../core/nutrition/units-weight';
import { formatNum } from '../shared/num.pipe';

// Re-Export: Bestandsimporte (z. B. Diary) bleiben unverändert gültig.
export { UNIT_WEIGHT_G, countMissingFacts };

/** Einheiten mit exaktem Gewicht (kein „≈“ nötig). */
const EXACT_UNITS = new Set(['g', 'kg', 'ml', 'l']);

/** Näherungseinheiten samt Gramm-Wert, für die ausklappbare Erklärung. */
export const APPROX_UNITS: readonly { unit: string; g: number }[] = Object.entries(UNIT_WEIGHT_G)
  .filter(([unit]) => !EXACT_UNITS.has(unit))
  .map(([unit, g]) => ({ unit, g }));

/** Gesamtgewicht der Zutaten in Gramm (Näherung bei EL, TL, Stk …). */
export function totalWeightG(ingredients: readonly (Pick<RecipeIngredient, 'amount' | 'unit'> & { name?: string })[]): number {
  return Math.round(
    ingredients.reduce((sum, i) => sum + i.amount * (unitGrams(i.unit, i.name) ?? 0), 0),
  );
}

/** True, wenn mindestens eine Zutat eine Näherungseinheit nutzt. */
export function hasApproxUnits(ingredients: readonly Pick<RecipeIngredient, 'unit'>[]): boolean {
  return ingredients.some((i) => !EXACT_UNITS.has(canonicalUnitKey(i.unit) ?? i.unit));
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

/** „1 Zutat“ / „3 Zutaten“. */
export function ingredientsLabel(count: number): string {
  return `${count} ${count === 1 ? 'Zutat' : 'Zutaten'}`;
}

/**
 * Nährwerte je Portion für die Anzeige: aus den Zutaten neu berechnet (heilt ältere,
 * inkonsistent gespeicherte Werte), sonst die gespeicherten Werte mit konsistenter kcal.
 */
export function recipeDisplayFacts(recipe: Pick<Recipe, 'ingredients' | 'servings' | 'factsPerServing'>): NutritionFacts | undefined {
  if (hasNutrition(recipe.ingredients)) return perServingFacts(recipe.ingredients, recipe.servings);
  return recipe.factsPerServing ? reconcileKcal(recipe.factsPerServing) : undefined;
}

/** Eine Meta-Zeile: „2 Portionen · 1 Zutat · 4 kcal gesamt“. */
export function recipeMetaLine(recipe: Pick<Recipe, 'servings' | 'ingredients'>, perServingKcal: number | undefined): string {
  const parts = [servingsLabel(recipe.servings), ingredientsLabel(recipe.ingredients.length)];
  if (perServingKcal !== undefined) parts.push(`${formatNum(perServingKcal * recipe.servings, 0)} kcal gesamt`);
  return parts.join(' · ');
}

/** True, wenn die Werte des Rezepts aus einem KI-Import stammen. */
export function isAiOrigin(origin: RecipeOrigin | undefined): boolean {
  return origin !== undefined && origin !== 'own' && origin !== 'online';
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

/** Bezugsgröße hinterlegter Zutaten-Nährwerte: „je 100 g“ oder „je Portion (30 g)“. */
export function factsBasisLabel(facts: Pick<NutritionFacts, 'basis' | 'portionG'>): string {
  if (facts.basis === 'per100g') return 'je 100 g';
  const g = facts.portionG;
  return g !== undefined && Number.isFinite(g) && g > 0 ? `je Portion (${String(Math.round(g * 10) / 10).replace('.', ',')} g)` : 'je Portion';
}

/** Einmalige Erklärung statt „≥“ an jeder Zahl, z. B. „Werte unvollständig (4 Zutaten ohne Nährwerte)“; leer, wenn nichts fehlt. */
export function lowerBoundNote(missingCount: number): string {
  return missingCount > 0 ? `Werte unvollständig (${missingCount} ${missingCount === 1 ? 'Zutat' : 'Zutaten'} ohne Nährwerte)` : '';
}

/** True, wenn die Einheit nicht in der Auswahlliste steht (Import-Prüfung). */
export function isUnknownUnit(unit: string, options: readonly string[]): boolean {
  return !!unit.trim() && !options.includes(unit);
}

/** Warum „Importieren“ noch nicht geht (leer = es geht). */
export function importBlockReason(text: string, url: string): string {
  return text.trim() || url.trim() ? '' : 'Füge einen Rezept-Text ein.';
}

/** Konkreter Grund eines fehlgeschlagenen Imports (503 / 429 / Netzwerk) statt einer Sammelmeldung. */
export function importErrorMessage(e: unknown, isOffline = false): string {
  const raw = e instanceof Error ? e.message : '';
  if (isOffline || /failed to fetch|networkerror|load failed|nicht erreichbar/i.test(raw)) return STATE_MESSAGES.offline;
  if (/\b503\b|überlastet/i.test(raw)) return STATE_MESSAGES.aiOverloaded;
  if (/\b429\b|zu viele|rate/i.test(raw)) return STATE_MESSAGES.rateLimited;
  return raw.trim() || STATE_MESSAGES.importFailed;
}
