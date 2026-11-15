import { NutritionBasis, NutritionFacts } from '../models';
import { isPlausiblePer100g } from '../food/facts-plausibility';
import { LabelResult } from './ai-provider';
import { cleanText, isInRange, numberInRange } from './sanitize-common';

const MAX_NAME_CHARS = 120;
/** Grenzen je Portion (je 100 g gilt isPlausiblePer100g): eine Portion kann deutlich größer sein. */
const PORTION_MAX_KCAL = 5000;
const PORTION_MAX_GRAMS = 1000;
const MAX_PORTION_G = 2000;

/** Meldung, wenn die Werte vom Etikett nicht sicher gelesen werden konnten. */
export const LABEL_INVALID_MESSAGE =
  'Die Nährwerte vom Etikett konnten nicht sicher gelesen werden. Mach ein schärferes Foto oder trage die Werte von Hand ein.';

function optionalGrams(value: unknown, max: number): number | undefined {
  return numberInRange(value, 0, max);
}

function requiredFacts(f: Record<string, unknown>, basis: NutritionBasis): NutritionFacts | null {
  const maxKcal = basis === 'per100g' ? Number.MAX_SAFE_INTEGER : PORTION_MAX_KCAL;
  const maxG = basis === 'per100g' ? Number.MAX_SAFE_INTEGER : PORTION_MAX_GRAMS;
  const { kcal, proteinG, carbsG, fatG } = f;
  if (!isInRange(kcal, 0, maxKcal) || !isInRange(proteinG, 0, maxG)) return null;
  if (!isInRange(carbsG, 0, maxG) || !isInRange(fatG, 0, maxG)) return null;
  return { kcal, proteinG, carbsG, fatG, basis };
}

function withOptionals(base: NutritionFacts, f: Record<string, unknown>): NutritionFacts {
  const fiberG = optionalGrams(f['fiberG'], Number.MAX_SAFE_INTEGER);
  const sugarG = optionalGrams(f['sugarG'], Number.MAX_SAFE_INTEGER);
  const saltG = optionalGrams(f['saltG'], Number.MAX_SAFE_INTEGER);
  const portionG = base.basis === 'perPortion' ? numberInRange(f['portionG'], Number.EPSILON, MAX_PORTION_G) : undefined;
  return {
    ...base,
    ...(fiberG === undefined ? {} : { fiberG }),
    ...(sugarG === undefined ? {} : { sugarG }),
    ...(saltG === undefined ? {} : { saltG }),
    ...(portionG === undefined ? {} : { portionG }),
  };
}

function isWithinPortionGrams(facts: NutritionFacts): boolean {
  const extras = [facts.fiberG, facts.sugarG, facts.saltG];
  return extras.every((g) => g === undefined || g <= PORTION_MAX_GRAMS);
}

/**
 * Prüft die KI-Antwort der Etikett-Erkennung. Pflichtwerte müssen endliche Zahlen sein, je 100 g gilt
 * {@link isPlausiblePer100g}; unlesbare optionale Werte entfallen. Bei einem unplausiblen Ergebnis: null.
 * Die Basis kommt aus der Anfrage, nie aus der Antwort.
 */
export function sanitizeLabelResult(raw: unknown, basis: NutritionBasis): LabelResult | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const f = r['facts'];
  if (typeof f !== 'object' || f === null) return null;
  const required = requiredFacts(f as Record<string, unknown>, basis);
  if (!required) return null;
  const facts = withOptionals(required, f as Record<string, unknown>);
  const plausible = basis === 'per100g' ? isPlausiblePer100g(facts) : isWithinPortionGrams(facts);
  if (!plausible) return null;
  return { name: cleanText(r['name'], MAX_NAME_CHARS) ?? '', facts };
}
