import { NutritionBasis, NutritionFacts } from '../models';
import { parseDecimal } from '../util/number-input';
import {
  MAX_GRAMS_PER_100G, MAX_KCAL_PER_100G, PORTION_MAX_GRAMS, PORTION_MAX_KCAL,
} from '../food/facts-plausibility';
import { readMachineNumber } from '../food/machine-number';
import { GRAM_UNITS } from '../nutrition/units-weight';
import { RecipeImportIngredient, RecipeImportResult } from './ai-provider';
import { boundedList, cleanText, isInRange } from './sanitize-common';

const DEFAULT_PORTION_G = 50;
const DEFAULT_SERVINGS = 2;
const FALLBACK_TITLE = 'Importiertes Rezept';

/** Obergrenzen für importierte (unvertrauenswürdige) Rezepte; darüber wird abgeschnitten bzw. verworfen. */
export const MAX_IMPORT_INGREDIENTS = 80;
export const MAX_IMPORT_STEPS = 60;
export const MAX_IMPORT_TITLE_CHARS = 120;
export const MAX_IMPORT_INGREDIENT_CHARS = 100;
export const MAX_IMPORT_UNIT_CHARS = 20;
export const MAX_IMPORT_STEP_CHARS = 1000;
export const MAX_IMPORT_SERVINGS = 100;
export const MAX_IMPORT_AMOUNT = 100000;
export const MAX_IMPORT_PORTION_G = 5000;

/** Zahl aus einem Modellwert: nie negativ, endlich, höchstens `max`. */
function num(v: unknown, max = MAX_IMPORT_AMOUNT): number {
  const n = parseDecimal(v);
  return n === null ? 0 : Math.min(max, Math.max(0, n));
}

/** Nährwert aus einem Modellwert (strikt, ohne Tausenderpunkt): nie negativ, höchstens `max`. */
function factNum(v: unknown, max = MAX_IMPORT_AMOUNT): number {
  const n = readMachineNumber(v);
  return n === null ? 0 : Math.min(max, Math.max(0, n));
}

/** Rohwert als Nährwert, aber ohne Begrenzung nach oben; Unsinn wird 0 (zur Prüfung der Plausibilität). */
function rawNum(v: unknown): number {
  const n = readMachineNumber(v);
  return n === null ? 0 : Math.max(0, n);
}

function deriveBasis(rawBasis: unknown, unit: string): NutritionBasis {
  if (rawBasis === 'per100g' || rawBasis === 'perPortion') return rawBasis;
  return GRAM_UNITS.has(unit.toLowerCase()) ? 'per100g' : 'perPortion';
}

function isWithinLimits(f: Record<string, unknown>, basis: NutritionBasis): boolean {
  const maxKcal = basis === 'per100g' ? MAX_KCAL_PER_100G : PORTION_MAX_KCAL;
  const maxG = basis === 'per100g' ? MAX_GRAMS_PER_100G : PORTION_MAX_GRAMS;
  const kcalOk = isInRange(rawNum(f['kcal']), 0, maxKcal);
  const gramsOk = ['proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG'].every((k) => isInRange(rawNum(f[k]), 0, maxG));
  return kcalOk && gramsOk;
}

/** Parst KI-Nährwerte einer Zutat defensiv; Basis wird aus der Einheit
 *  abgeleitet, falls die KI keine gültige Basis liefert. Unplausible Werte (über den Grenzen)
 *  werden verworfen statt übernommen: die Zutat hat dann keine Nährwerte. */
export function parseIngredientFacts(raw: unknown, unit: string): NutritionFacts | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const kcal = factNum(f['kcal']);
  const proteinG = factNum(f['proteinG']);
  const carbsG = factNum(f['carbsG']);
  const fatG = factNum(f['fatG']);
  // Reine Null-Werte (z.B. Wasser/Salz liefern 0) nur verwerfen, wenn ALLES 0 ist.
  if (kcal === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) return undefined;

  const basis = deriveBasis(f['basis'], unit);
  if (!isWithinLimits(f, basis)) return undefined;
  const portionG = basis === 'perPortion' ? num(f['portionG'], MAX_IMPORT_PORTION_G) || DEFAULT_PORTION_G : undefined;
  return {
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: factNum(f['fiberG']),
    sugarG: factNum(f['sugarG']),
    basis,
    portionG,
  };
}

function parseIngredient(raw: unknown): RecipeImportIngredient | null {
  if (!raw || typeof raw !== 'object') return null;
  const i = raw as Record<string, unknown>;
  const name = cleanText(i['name'], MAX_IMPORT_INGREDIENT_CHARS);
  if (!name) return null;
  const unit = cleanText(i['unit'], MAX_IMPORT_UNIT_CHARS) || 'g';
  return { name, amount: num(i['amount']), unit, facts: parseIngredientFacts(i['facts'], unit) };
}

function parseSteps(raw: unknown): string[] {
  return boundedList(raw, MAX_IMPORT_STEPS)
    .map((s) => cleanText(typeof s === 'number' ? String(s) : s, MAX_IMPORT_STEP_CHARS))
    .filter((s): s is string => !!s);
}

/**
 * Macht aus einer (unvertrauenswürdigen) KI-Antwort ein gültiges
 * {@link RecipeImportResult} — gemeinsam genutzt von Gemini-direkt und Proxy.
 * Zahl der Zutaten und Schritte, Textlängen, Portionen und Mengen sind begrenzt.
 */
export function normalizeRecipeImport(raw: unknown, sourceUrl?: string): RecipeImportResult {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ingredients = boundedList(obj['ingredients'], MAX_IMPORT_INGREDIENTS)
    .map(parseIngredient)
    .filter((i): i is RecipeImportIngredient => i !== null);
  return {
    title: cleanText(obj['title'], MAX_IMPORT_TITLE_CHARS) || FALLBACK_TITLE,
    servings: Math.max(1, Math.round(num(obj['servings'], MAX_IMPORT_SERVINGS) || DEFAULT_SERVINGS)),
    ingredients,
    steps: parseSteps(obj['steps']),
    sourceUrl,
    ...(obj['usedFallbackText'] === true ? { usedFallbackText: true } : {}),
  };
}
