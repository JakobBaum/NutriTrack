import { NutritionBasis, NutritionFacts } from '../models';
import { RecipeImportIngredient, RecipeImportResult } from './ai-provider';

// Einheiten, die 1:1 als Gramm/Milliliter gelten (→ Bezug per100g).
const GRAM_UNITS = new Set(['g', 'gramm', 'gr', 'ml', 'milliliter']);
const DEFAULT_PORTION_G = 50;
const DEFAULT_SERVINGS = 2;
const FALLBACK_TITLE = 'Importiertes Rezept';

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  // Nährwerte und Mengen sind nie negativ — defekte Modellwerte abfangen.
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Parst KI-Nährwerte einer Zutat defensiv; Basis wird aus der Einheit
 *  abgeleitet, falls die KI keine gültige Basis liefert. */
export function parseIngredientFacts(raw: unknown, unit: string): NutritionFacts | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const kcal = num(f['kcal']);
  const proteinG = num(f['proteinG']);
  const carbsG = num(f['carbsG']);
  const fatG = num(f['fatG']);
  // Reine Null-Werte (z.B. Wasser/Salz liefern 0) nur verwerfen, wenn ALLES 0 ist.
  if (kcal === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) return undefined;

  const gramUnit = GRAM_UNITS.has(unit.toLowerCase());
  const rawBasis = String(f['basis'] ?? '');
  const basis: NutritionBasis =
    rawBasis === 'per100g' || rawBasis === 'perPortion'
      ? (rawBasis as NutritionBasis)
      : gramUnit
        ? 'per100g'
        : 'perPortion';
  const portionG = basis === 'perPortion' ? num(f['portionG']) || DEFAULT_PORTION_G : undefined;
  return {
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: num(f['fiberG']),
    sugarG: num(f['sugarG']),
    basis,
    portionG,
  };
}

function parseIngredient(raw: unknown): RecipeImportIngredient | null {
  if (!raw || typeof raw !== 'object') return null;
  const i = raw as Record<string, unknown>;
  const name = String(i['name'] ?? '').trim();
  if (!name) return null;
  const unit = String(i['unit'] ?? 'g').trim() || 'g';
  return { name, amount: num(i['amount']), unit, facts: parseIngredientFacts(i['facts'], unit) };
}

/**
 * Macht aus einer (unvertrauenswürdigen) KI-Antwort ein gültiges
 * {@link RecipeImportResult} — gemeinsam genutzt von Gemini-direkt und Proxy.
 */
export function normalizeRecipeImport(raw: unknown, sourceUrl?: string): RecipeImportResult {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ingredients = Array.isArray(obj['ingredients'])
    ? obj['ingredients'].map(parseIngredient).filter((i): i is RecipeImportIngredient => i !== null)
    : [];
  return {
    title: String(obj['title'] ?? FALLBACK_TITLE).trim() || FALLBACK_TITLE,
    servings: Math.max(1, Math.round(num(obj['servings']) || DEFAULT_SERVINGS)),
    ingredients,
    steps: Array.isArray(obj['steps'])
      ? obj['steps'].map((s) => String(s).trim()).filter((s) => s.length > 0)
      : [],
    sourceUrl,
  };
}
