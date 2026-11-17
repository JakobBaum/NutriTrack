import { NutritionFacts } from '../models';
import {
  ATWATER_SLACK_PER_100G, MAX_GRAMS_PER_100G, MAX_KCAL_PER_100G, isAtwaterDoubtful, isWithinPer100gLimits,
} from '../food/facts-plausibility';
import { MAX_MEAL_ITEMS, MealParseResult, ParsedMealItem } from './meal-parse';
import { boundedList, cleanText, isInRange } from './sanitize-common';

const MAX_NAME_CHARS = 80;
const MAX_UNIT_CHARS = 20;
const FALLBACK_UNIT = 'g';
/** Gewicht einer Zeile in g oder ml. */
export const PORTION_RANGE_G = { min: 1, max: 2000 } as const;
/** Obergrenze der angezeigten Menge (nur Anzeige, z. B. "2 Stk"). */
const MAX_DISPLAY_AMOUNT = 10000;

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RawRecord) : null;
}

function cleanPer100g(raw: unknown): NutritionFacts | null {
  const f = asRecord(raw);
  if (!f) return null;
  const { kcal, proteinG, carbsG, fatG } = f;
  if (!isInRange(kcal, 0, MAX_KCAL_PER_100G)) return null;
  if (!isInRange(proteinG, 0, MAX_GRAMS_PER_100G)) return null;
  if (!isInRange(carbsG, 0, MAX_GRAMS_PER_100G)) return null;
  if (!isInRange(fatG, 0, MAX_GRAMS_PER_100G)) return null;
  const facts: NutritionFacts = { kcal, proteinG, carbsG, fatG, basis: 'per100g' };
  return isWithinPer100gLimits(facts) ? facts : null;
}

/** Menge und Einheit sind nur Anzeige; ungültig heißt: Gewicht in Gramm. */
function cleanAmountAndUnit(r: RawRecord, portionG: number): Pick<ParsedMealItem, 'amount' | 'unit'> {
  const unit = cleanText(r['unit'], MAX_UNIT_CHARS);
  const amount = r['amount'];
  if (isInRange(amount, Number.MIN_VALUE, MAX_DISPLAY_AMOUNT) && unit) return { amount, unit };
  return { amount: portionG, unit: FALLBACK_UNIT };
}

function cleanItem(raw: unknown): ParsedMealItem | null {
  const r = asRecord(raw);
  if (!r) return null;
  const name = cleanText(r['name'], MAX_NAME_CHARS);
  const portionG = r['portionG'];
  if (!name || !isInRange(portionG, PORTION_RANGE_G.min, PORTION_RANGE_G.max)) return null;
  const per100g = cleanPer100g(r['per100g']);
  if (!per100g) return null;
  return { name, ...cleanAmountAndUnit(r, portionG), portionG, per100g, isKcalDoubtful: isAtwaterDoubtful(per100g, ATWATER_SLACK_PER_100G) };
}

/**
 * Prüft die Antwort von `parseMeal` (unbekannte Form): nur bekannte Felder, Namen bereinigt und gekürzt,
 * Gewicht 1 bis 2000 g, je 100 g kcal 0 bis 900 und Makros 0 bis 100, höchstens 12 Zeilen. Durchgefallene Zeilen
 * entfallen und werden gezählt; kcal-Abweichungen von 4/4/9 über 25 % werden nur markiert, nie korrigiert.
 */
export function sanitizeMealParse(raw: unknown): MealParseResult {
  const list = boundedList(asRecord(raw)?.['items'], MAX_MEAL_ITEMS);
  const items = list.map(cleanItem).filter((i): i is ParsedMealItem => i !== null);
  return { items, droppedCount: list.length - items.length };
}
