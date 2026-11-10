import { MealType } from '../models';
import { OnlineRecipe, OnlineSearchPage } from '../recipes/online/online-recipe.model';
import { OnlineSearchFilters } from '../recipes/online/spoonacular.query';
import { WeekPlanRecipe } from './week-plan.model';
import {
  MEAL_LABELS,
  MEAL_ORDER,
  SPOON_MEAL_TYPE,
  mealMaxCalories,
  mealMinProtein,
  proteinSteps,
} from './week-plan-targets';

/** Suchfunktion (SpoonacularProvider.search), injiziert für Tests. */
export type RecipeSearchFn = (filters: OnlineSearchFilters, offset: number, number: number) => Promise<OnlineSearchPage>;

export interface WeekPlanInput {
  persons: number;
  days: number;
  meals: readonly MealType[];
  /** Tagesziel kcal je Person (null = ohne Kalorienlimit). */
  dailyKcal: number | null;
  /** Proteinziel g je Tag (null = Fallback-Werte). */
  dailyProteinG: number | null;
  /** Rezept-Ids, die nicht vorgeschlagen werden dürfen (gesperrt oder schon im Plan). */
  excludeIds?: readonly string[];
  /** Mindestzahl angefragter Treffer (z. B. beim Tauschen eines einzelnen Rezepts, damit Auswahl bleibt). */
  requestFloor?: number;
}

export interface WeekPlanDraft {
  recipes: WeekPlanRecipe[];
  notices: string[];
}

/** Zufallsstreuung nur innerhalb der ersten Treffer, damit die Qualität (Sortierung) erhalten bleibt. */
export const OFFSET_WINDOW = 50;
/** Obergrenze von `number` beim Worker. */
export const MAX_REQUEST_NUMBER = 20;

/** Zufälliger Offset, sodass offset + number im Fenster {@link OFFSET_WINDOW} bleibt. */
export function randomOffset(number: number, rng: () => number): number {
  return Math.floor(rng() * Math.max(1, OFFSET_WINDOW - number + 1));
}

interface MealSearch {
  picked: OnlineRecipe[];
  /** Ob das Eiweiß-Minimum gelockert werden musste, und der Wert der letzten Stufe (null = ohne). */
  relaxed: boolean;
  usedMinProtein: number | null;
}

async function fetchPage(
  search: RecipeSearchFn,
  filters: OnlineSearchFilters,
  number: number,
  rng: () => number,
): Promise<OnlineSearchPage> {
  const offset = randomOffset(number, rng);
  const page = await search(filters, offset, number);
  // Zufallsfenster hinter dem Ende der Treffer: einmal von vorn versuchen.
  return page.recipes.length === 0 && offset > 0 ? search(filters, 0, number) : page;
}

function uniqueById(list: readonly OnlineRecipe[]): OnlineRecipe[] {
  return list.filter((r, i) => list.findIndex((o) => o.id === r.id) === i);
}

async function searchMeal(
  search: RecipeSearchFn,
  meal: MealType,
  input: WeekPlanInput,
  exclude: ReadonlySet<string>,
  number: number,
  rng: () => number,
): Promise<MealSearch> {
  const steps = proteinSteps(mealMinProtein(input.dailyProteinG, meal));
  let picked: OnlineRecipe[] = [];
  let stepIndex = 0;
  for (const [index, minProtein] of steps.entries()) {
    stepIndex = index;
    const filters: OnlineSearchFilters = {
      query: '',
      maxCalories: mealMaxCalories(input.dailyKcal, meal),
      maxReadyTime: null,
      diet: '',
      type: SPOON_MEAL_TYPE[meal],
      minProtein,
      sort: 'healthiness',
    };
    const page = await fetchPage(search, filters, number, rng);
    const known = new Set([...exclude, ...picked.map((r) => r.id)]);
    picked = uniqueById([...picked, ...page.recipes.filter((r) => !known.has(r.id))]);
    if (picked.length >= input.days) break;
  }
  return { picked: picked.slice(0, input.days), relaxed: stepIndex > 0, usedMinProtein: steps[stepIndex] };
}

function mealNotices(meal: MealType, days: number, found: MealSearch): string[] {
  const label = MEAL_LABELS[meal];
  const notices: string[] = [];
  if (found.relaxed) {
    const detail = found.usedMinProtein === null ? 'ohne Mindestwert' : `mind. ${found.usedMinProtein} g`;
    notices.push(`${label}: weniger Eiweiß als Ziel (${detail}).`);
  }
  if (found.picked.length < days) {
    notices.push(`${label}: nur ${found.picked.length} von ${days} Rezepten gefunden.`);
  }
  return notices;
}

/**
 * Sucht je gewählter Mahlzeit gesunde High-Protein-Rezepte (eine Anfrage je Mahlzeit, bei
 * zu wenigen Treffern mit gelockertem Eiweiß-Minimum), ohne Duplikate über alle Mahlzeiten.
 * Fehler der Suche werden an den Aufrufer weitergegeben.
 */
export async function buildWeekPlanRecipes(
  search: RecipeSearchFn,
  input: WeekPlanInput,
  rng: () => number = Math.random,
): Promise<WeekPlanDraft> {
  const meals = MEAL_ORDER.filter((m) => input.meals.includes(m));
  let recipes: WeekPlanRecipe[] = [];
  let notices: string[] = [];
  const typeCount = new Map<string, number>();
  for (const meal of meals) {
    const type = SPOON_MEAL_TYPE[meal];
    const earlier = typeCount.get(type) ?? 0;
    typeCount.set(type, earlier + 1);
    // Mittag und Abend teilen den Typ: mehr anfragen, damit nach dem Entfernen von Duplikaten genug bleiben.
    const number = Math.min(MAX_REQUEST_NUMBER, Math.max(input.requestFloor ?? 0, input.days * (1 + earlier)));
    const exclude = new Set([...(input.excludeIds ?? []), ...recipes.map((r) => r.id)]);
    const found = await searchMeal(search, meal, input, exclude, number, rng);
    recipes = [...recipes, ...found.picked.map((r) => ({ ...r, meal, portions: input.persons }))];
    notices = [...notices, ...mealNotices(meal, input.days, found)];
  }
  return { recipes, notices };
}
