import { MealType, NutritionFacts, Recipe, RecipeIngredient, RecipeOrigin } from '../core/models';
import { RecipeImportResult } from '../core/ai/ai-provider';
import { perServingFacts } from '../core/nutrition/recipe-nutrition';
import { parseDecimal } from '../core/util/number-input';
import { NewDiaryEntry } from '../core/state/diary.store';
import { RecipeDraft } from '../core/state/recipe.store';
import {
  countMissingFacts,
  isValidYield,
  recipeDisplayFacts,
  scaleFacts,
  totalWeightG,
} from './recipe-view';

/** Zutat im Bearbeiten-Formular (Menge als Zahl oder leer). */
export interface IngredientForm {
  name: string;
  amount: number | null;
  unit: string;
  facts?: NutritionFacts;
  foodItemId?: string;
}

export interface RecipeForm {
  title: string;
  servings: number | null;
  cookedWeightG: number | null;
  ingredients: IngredientForm[];
  steps: string[];
}

export type FactKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sugarG';

const DEFAULT_SERVINGS = 2;
const TITLE_MISSING = 'Titel fehlt — bitte einen Namen eintragen.';
const YIELD_INVALID = '„Ergibt“ braucht mindestens 1 Portion, ganz oder halb (z. B. 2 oder 2,5).';

export function emptyForm(): RecipeForm {
  return { title: '', servings: DEFAULT_SERVINGS, cookedWeightG: null, ingredients: [], steps: [''] };
}

function stepsOrBlank(steps: readonly string[]): string[] {
  return steps.length ? [...steps] : [''];
}

export function formFromRecipe(recipe: Recipe): RecipeForm {
  return {
    title: recipe.title,
    servings: recipe.servings,
    cookedWeightG: recipe.cookedWeightG ?? null,
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      facts: i.facts,
      foodItemId: i.foodItemId,
    })),
    steps: stepsOrBlank(recipe.steps),
  };
}

export function formFromImport(res: RecipeImportResult): RecipeForm {
  return {
    title: res.title,
    servings: res.servings || DEFAULT_SERVINGS,
    cookedWeightG: null,
    ingredients: res.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, facts: i.facts })),
    steps: stepsOrBlank(res.steps),
  };
}

/** Nur endliche Mengen größer 0 zählen, sonst 0 (= ohne Menge). */
export function positiveOrZero(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Formular-Zutaten als Rezept-Zutaten (ohne leere Namen, getrimmt, Standardeinheit g). */
export function toRecipeIngredients(items: readonly IngredientForm[]): RecipeIngredient[] {
  return items
    .filter((i) => i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      amount: positiveOrZero(i.amount),
      unit: (i.unit ?? '').trim() || 'g',
      facts: i.facts,
      foodItemId: i.foodItemId,
    }));
}

function hasOwnWeight(cookedWeightG: number | null): cookedWeightG is number {
  return cookedWeightG != null && cookedWeightG > 0;
}

/** Wert im Feld „Fertig gekocht“: eigene Eingabe, sonst das berechnete Gewicht. */
export function cookedWeightValue(cookedWeightG: number | null, autoWeightG: number): number | null {
  if (hasOwnWeight(cookedWeightG)) return cookedWeightG;
  return autoWeightG > 0 ? autoWeightG : null;
}

/** True, solange das Gewicht nur geschätzt (aus den Zutaten berechnet) ist. */
export function cookedWeightIsEstimate(cookedWeightG: number | null, autoWeightG: number): boolean {
  return !hasOwnWeight(cookedWeightG) && autoWeightG > 0;
}

/** Neue Eingabe fürs Fertiggewicht: leer, 0 oder unverändert = wieder die Schätzung (null). */
export function nextCookedWeight(input: unknown, autoWeightG: number): number | null {
  const parsed = parseDecimal(input);
  return parsed !== null && parsed > 0 && parsed !== autoWeightG ? parsed : null;
}

/** Setzt einen Nährwert immutabel; Ballast und Zucker bleiben bei ungültiger Eingabe leer. */
export function applyFact(facts: NutritionFacts, key: FactKey, value: unknown): NutritionFacts {
  const parsed = parseDecimal(value);
  const optional = key === 'fiberG' || key === 'sugarG';
  return { ...facts, [key]: optional ? parsed ?? undefined : parsed ?? 0 };
}

export type DraftResult = { draft: RecipeDraft } | { error: string };

/** Prüft das Formular und baut den Rezept-Entwurf (kein Zugriff auf Store oder UI). */
export function buildRecipeDraft(form: RecipeForm, origin: RecipeOrigin): DraftResult {
  const title = form.title.trim();
  if (!title) return { error: TITLE_MISSING };
  const servings = parseDecimal(form.servings);
  if (!isValidYield(servings)) return { error: YIELD_INVALID };
  const ingredients = toRecipeIngredients(form.ingredients);
  const autoWeight = totalWeightG(ingredients);
  const cookedWeightG = hasOwnWeight(form.cookedWeightG)
    ? Number(form.cookedWeightG)
    : autoWeight > 0 ? autoWeight : undefined;
  return {
    draft: {
      title,
      servings,
      cookedWeightG,
      ingredients,
      steps: form.steps.map((s) => s.trim()).filter(Boolean),
      origin,
      factsPerServing: perServingFacts(ingredients, servings),
    },
  };
}

const ZERO_PORTION_FACTS: NutritionFacts = {
  kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, basis: 'perPortion',
};

/** Tagebuch-Eintrag für gegessene Portionen eines Rezepts (Untergrenze bei fehlenden Zutatenwerten). */
export function recipeDiaryEntry(recipe: Recipe, meal: MealType, portions: number, dateISO: string): NewDiaryEntry {
  const perPortion = recipeDisplayFacts(recipe) ?? ZERO_PORTION_FACTS;
  const isPartial = countMissingFacts(recipe.ingredients) > 0;
  return {
    dateISO,
    meal,
    label: recipe.title,
    ref: { kind: 'recipe', recipeId: recipe.id },
    servings: portions,
    facts: scaleFacts(perPortion, portions),
    ...(isPartial ? { isPartial: true } : {}),
  };
}
