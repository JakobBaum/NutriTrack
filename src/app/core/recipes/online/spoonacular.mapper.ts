import { NutritionFacts, RecipeIngredient } from '../../models';
import { RecipeDraft } from '../../state/recipe.store';
import { isUsUnit, toMetric } from '../../shopping/units/unit-convert';
import { OnlineRecipe } from './online-recipe.model';
import {
  SpoonExtendedIngredient,
  SpoonNutrient,
  SpoonNutritionIngredient,
  SpoonRecipe,
} from './spoonacular.types';

const MG_PER_G = 1000;
/** Salz (g) = Natrium (g) × 2,5. */
const SALT_PER_SODIUM = 2.5;
const METRIC_UNITS: Readonly<Record<string, string>> = { g: 'g', ml: 'ml', kg: 'kg', l: 'l' };

const IMPERIAL_G: Readonly<Record<string, number>> = { oz: 28.35, lb: 453.6 };

/** Englische Einheiten → App-Einheiten (Rest bleibt unverändert). */
const UNIT_MAP: Readonly<Record<string, string>> = {
  tbsp: 'EL', tbsps: 'EL', tablespoon: 'EL', tablespoons: 'EL',
  tsp: 'TL', tsps: 'TL', teaspoon: 'TL', teaspoons: 'TL',
  cup: 'Tasse', cups: 'Tasse',
  clove: 'Zehe', cloves: 'Zehe',
  slice: 'Scheibe', slices: 'Scheibe',
  pinch: 'Prise', pinches: 'Prise',
  bunch: 'Bund', bunches: 'Bund',
  can: 'Dose', cans: 'Dose',
  package: 'Pck', packages: 'Pck', pkg: 'Pck',
  serving: 'Stk', servings: 'Stk', piece: 'Stk', pieces: 'Stk',
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', ml: 'ml', l: 'l', oz: 'oz', lb: 'lb', lbs: 'lb',
};

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Menge lesbar runden: ab 10 ganze Zahl, sonst 2 Nachkommastellen. */
function roundAmount(v: number): number {
  return v >= 10 ? Math.round(v) : round(v, 2);
}

function nutrientAmount(list: readonly SpoonNutrient[] | undefined, name: string): number | undefined {
  const hit = (list ?? []).find((n) => (n.name ?? '').toLowerCase() === name.toLowerCase());
  return hit && typeof hit.amount === 'number' && Number.isFinite(hit.amount) ? hit.amount : undefined;
}

/** Nährwerte (Gesamtmenge der Liste) aus Spoonacular-Nutrients; ohne Kalorien → undefined. */
export function factsFromNutrients(list: readonly SpoonNutrient[] | undefined): NutritionFacts | undefined {
  const kcal = nutrientAmount(list, 'Calories');
  if (kcal === undefined) return undefined;
  const sodiumMg = nutrientAmount(list, 'Sodium');
  const sugar = nutrientAmount(list, 'Sugar');
  const fiber = nutrientAmount(list, 'Fiber');
  return {
    kcal: Math.round(kcal),
    proteinG: round(nutrientAmount(list, 'Protein') ?? 0, 1),
    carbsG: round(nutrientAmount(list, 'Carbohydrates') ?? 0, 1),
    fatG: round(nutrientAmount(list, 'Fat') ?? 0, 1),
    ...(fiber !== undefined ? { fiberG: round(fiber, 1) } : {}),
    ...(sugar !== undefined ? { sugarG: round(sugar, 1) } : {}),
    ...(sodiumMg !== undefined ? { saltG: round((sodiumMg / MG_PER_G) * SALT_PER_SODIUM, 2) } : {}),
    basis: 'perPortion',
  };
}

/** Menge + Einheit einer Zutat: bevorzugt metrisch (g/ml), sonst App-Einheit. */
export function mapAmountUnit(ing: SpoonExtendedIngredient): { amount: number; unit: string; approx?: boolean } {
  const metric = ing.measures?.metric;
  const metricUnit = METRIC_UNITS[(metric?.unitShort ?? '').trim().toLowerCase()];
  if (metric && metricUnit && typeof metric.amount === 'number' && metric.amount > 0) {
    return { amount: roundAmount(metric.amount), unit: metricUnit };
  }
  const amount = typeof ing.amount === 'number' && ing.amount > 0 ? roundAmount(ing.amount) : 0;
  const raw = (ing.unit ?? '').trim().toLowerCase();
  if (amount > 0 && isUsUnit(raw)) {
    // Tassen, Unzen, Pfund ...: metrisch speichern; ohne bekannte Dichte nur ungefähr (approx).
    const m = toMetric(amount, raw, (ing.nameClean ?? ing.name ?? '').trim());
    return { amount: roundAmount(m.amount), unit: m.unit, ...(m.approx ? { approx: true } : {}) };
  }
  const mapped = raw === '' ? 'Stk' : UNIT_MAP[raw] ?? (ing.unit ?? '').trim();
  const imperialG = IMPERIAL_G[mapped];
  if (imperialG !== undefined && amount > 0) return { amount: roundAmount(amount * imperialG), unit: 'g' };
  return { amount, unit: mapped };
}

/** Passende Nährwert-Zeile zu einer Zutat: per Id, sonst bei gleicher Länge per Position. */
function matchNutrition(
  ext: SpoonExtendedIngredient,
  index: number,
  all: readonly SpoonNutritionIngredient[],
  extCount: number,
  used: Set<number>,
): SpoonNutritionIngredient | undefined {
  const byId = all.findIndex((n, i) => !used.has(i) && n.id !== undefined && n.id === ext.id);
  const pick = byId >= 0 ? byId : all.length === extCount && !used.has(index) ? index : -1;
  if (pick < 0) return undefined;
  used.add(pick);
  return all[pick];
}

/**
 * Nährwerte einer Zutat in der App-Form: Gewichts-/Volumeneinheit → Werte für die
 * ganze Menge (portionG = Menge), sonst Werte für EINE Einheit.
 */
function ingredientFacts(total: NutritionFacts | undefined, amount: number, unit: string): NutritionFacts | undefined {
  if (!total || amount <= 0) return undefined;
  const weighed = METRIC_UNITS[unit.toLowerCase()] !== undefined;
  if (weighed) {
    const toG = unit === 'kg' || unit === 'l' ? 1000 : 1;
    return { ...total, basis: 'perPortion', portionG: amount * toG };
  }
  const per = (v: number): number => round(v / amount, 4);
  return {
    kcal: per(total.kcal),
    proteinG: per(total.proteinG),
    carbsG: per(total.carbsG),
    fatG: per(total.fatG),
    ...(total.fiberG !== undefined ? { fiberG: per(total.fiberG) } : {}),
    ...(total.sugarG !== undefined ? { sugarG: per(total.sugarG) } : {}),
    basis: 'perPortion',
  };
}

export function mapIngredients(raw: SpoonRecipe): RecipeIngredient[] {
  const ext = raw.extendedIngredients ?? [];
  const nutrition = raw.nutrition?.ingredients ?? [];
  const used = new Set<number>();
  const out: RecipeIngredient[] = [];
  ext.forEach((e, i) => {
    const name = (e.nameClean ?? e.name ?? e.original ?? '').trim();
    if (!name) return;
    const { amount, unit, approx } = mapAmountUnit(e);
    const facts = ingredientFacts(factsFromNutrients(matchNutrition(e, i, nutrition, ext.length, used)?.nutrients), amount, unit);
    out.push({ name, amount, unit, ...(approx ? { approx } : {}), ...(facts ? { facts } : {}) });
  });
  return out;
}

export function mapSteps(raw: SpoonRecipe): string[] {
  return (raw.analyzedInstructions ?? [])
    .flatMap((group) => group.steps ?? [])
    .map((s) => (s.step ?? '').trim())
    .filter((s) => s.length > 0);
}

function safeHttpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Einen Spoonacular-Treffer in ein {@link OnlineRecipe}; ohne Id/Titel → null. */
export function mapSpoonRecipe(raw: SpoonRecipe): OnlineRecipe | null {
  const title = (raw.title ?? '').trim();
  if (raw.id === undefined || !title) return null;
  const servings = typeof raw.servings === 'number' && raw.servings >= 1 ? Math.round(raw.servings) : 1;
  return {
    id: String(raw.id),
    title,
    imageUrl: safeHttpUrl(raw.image),
    readyInMinutes: typeof raw.readyInMinutes === 'number' && raw.readyInMinutes > 0 ? Math.round(raw.readyInMinutes) : undefined,
    servings,
    sourceName: raw.sourceName?.trim() || undefined,
    sourceUrl: safeHttpUrl(raw.sourceUrl) ?? safeHttpUrl(raw.spoonacularSourceUrl),
    facts: factsFromNutrients(raw.nutrition?.nutrients),
    ingredients: mapIngredients(raw),
    steps: mapSteps(raw),
  };
}

/** Entwurf für den RecipeStore (landet danach in der normalen Rezeptliste). */
export function toRecipeDraft(recipe: OnlineRecipe): RecipeDraft {
  return {
    title: recipe.title,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    origin: 'online',
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipe.imageUrl,
    factsPerServing: recipe.facts,
  };
}
