import { NutritionFacts } from '../models';

/** Reines Fett liefert rund 900 kcal je 100 g; mehr ist physikalisch nicht möglich. */
const MAX_KCAL_PER_100G = 900;
const MAX_GRAMS_PER_100G = 100;
/** Spielraum für gerundete Herstellerangaben bei der Summe aus Eiweiß, Kohlenhydraten und Fett. */
const MACRO_SUM_TOLERANCE_G = 5;

const inRange = (value: number | undefined, max: number): boolean =>
  value === undefined || (Number.isFinite(value) && value >= 0 && value <= max);

/**
 * Prüft Nährwerte je 100 g aus fremden Quellen (z. B. Open Food Facts) auf harte Grenzen.
 * Offensichtlich falsche Einträge dürfen nicht ins Tagebuch gelangen.
 */
export function isPlausiblePer100g(facts: NutritionFacts): boolean {
  const grams = [facts.proteinG, facts.carbsG, facts.fatG, facts.fiberG, facts.sugarG, facts.saltG];
  if (!inRange(facts.kcal, MAX_KCAL_PER_100G)) return false;
  if (!grams.every((g) => inRange(g, MAX_GRAMS_PER_100G))) return false;
  return facts.proteinG + facts.carbsG + facts.fatG <= MAX_GRAMS_PER_100G + MACRO_SUM_TOLERANCE_G;
}
