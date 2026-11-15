/**
 * Prüfung eines geladenen oder importierten Wochenplans (Review 3, Befund 6). Rein, wirft nie.
 * Kaputte Rezepte, Zutaten und Schritte fallen weg; fehlen Pflichtangaben des Plans oder bleibt kein Rezept übrig, ist der Plan unbrauchbar (`null`).
 */
import { MealType, RecipeIngredient } from '../models';
import { WeekPlan, WeekPlanRecipe } from '../week-plan/week-plan.model';

type Rec = Record<string, unknown>;

const MEALS: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const URL_PATTERN = /^https?:\/\//i;
const MIN_COUNT = 1;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= MIN_COUNT;
const isMeal = (v: unknown): v is MealType => isStr(v) && (MEALS as readonly string[]).includes(v);
const isUrl = (v: unknown): v is string => isStr(v) && URL_PATTERN.test(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function toIngredient(v: unknown): RecipeIngredient | null {
  if (!isRec(v) || !isStr(v['name']) || !isNum(v['amount']) || !isStr(v['unit'])) return null;
  return { ...(v as unknown as RecipeIngredient) };
}

function hasFacts(v: unknown): boolean {
  return isRec(v) && [v['kcal'], v['proteinG'], v['carbsG'], v['fatG']].every(isNum);
}

/** Optionale Rezeptfelder; nur mit passendem Typ übernommen (Adressen nur http/https). */
function optionalRecipeFields(v: Rec): Partial<WeekPlanRecipe> {
  return {
    ...(isUrl(v['imageUrl']) ? { imageUrl: v['imageUrl'] } : {}),
    ...(isUrl(v['sourceUrl']) ? { sourceUrl: v['sourceUrl'] } : {}),
    ...(isStr(v['sourceName']) ? { sourceName: v['sourceName'] } : {}),
    ...(isNum(v['readyInMinutes']) ? { readyInMinutes: v['readyInMinutes'] } : {}),
    ...(hasFacts(v['facts']) ? { facts: v['facts'] as WeekPlanRecipe['facts'] } : {}),
    ...(v['lang'] === 'de' || v['lang'] === 'en' ? { lang: v['lang'] } : {}),
  };
}

function toRecipe(v: unknown): WeekPlanRecipe | null {
  if (!isRec(v) || !isStr(v['id']) || !isStr(v['title']) || !isMeal(v['meal'])) return null;
  if (!isNum(v['servings']) || v['servings'] < MIN_COUNT || !isNum(v['portions']) || v['portions'] <= 0) return null;
  return {
    id: v['id'],
    title: v['title'],
    servings: v['servings'],
    meal: v['meal'],
    portions: v['portions'],
    ingredients: asArray(v['ingredients']).map(toIngredient).filter((i): i is RecipeIngredient => i !== null),
    steps: asArray(v['steps']).filter(isStr),
    ...optionalRecipeFields(v),
  };
}

/** Bereinigter Plan oder `null`. */
export function sanitizeWeekPlan(raw: unknown): WeekPlan | null {
  if (!isRec(raw) || !isStr(raw['id']) || !isStr(raw['generatedAt'])) return null;
  if (!isCount(raw['persons']) || !isCount(raw['days']) || !Array.isArray(raw['recipes'])) return null;
  const meals = asArray(raw['meals']).filter(isMeal);
  const recipes = raw['recipes'].map(toRecipe).filter((r): r is WeekPlanRecipe => r !== null);
  if (meals.length === 0 || recipes.length === 0) return null;
  return {
    id: raw['id'],
    generatedAt: raw['generatedAt'],
    persons: raw['persons'],
    days: raw['days'],
    meals,
    recipes,
    notices: asArray(raw['notices']).filter(isStr),
  };
}

/** Gesperrte Rezept-Ids: nur Texte, ohne Duplikate. */
export function sanitizeBlocked(raw: unknown): string[] {
  return [...new Set(asArray(raw).filter(isStr))];
}
