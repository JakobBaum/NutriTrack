/**
 * Inhaltsprüfung der Backup-Datensätze (QAE-01): Pflichtfelder und Typen, damit ein
 * beschädigtes oder fremdes Backup die Stores nicht zum Absturz bringt.
 */

import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../weight/weight-math';

type Rec = Record<string, unknown>;

const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptNum = (v: unknown): boolean => v === undefined || v === null || isNum(v);

/** Nährwerte: kcal, Eiweiß, Kohlenhydrate, Fett endlich; optionale Werte endlich oder fehlend. */
function isFacts(v: unknown): boolean {
  if (!isRec(v)) return false;
  const required = [v['kcal'], v['proteinG'], v['carbsG'], v['fatG']].every(isNum);
  return required && [v['fiberG'], v['sugarG'], v['saltG']].every(isOptNum);
}

function isDiaryEntry(v: unknown): boolean {
  if (!isRec(v)) return false;
  return (
    isStr(v['id']) &&
    isStr(v['dateISO']) && ISO_DAY.test(v['dateISO']) &&
    isStr(v['meal']) && MEALS.has(v['meal']) &&
    isStr(v['label']) &&
    isStr(v['createdAt']) && !Number.isNaN(Date.parse(v['createdAt'])) &&
    isFacts(v['facts']) &&
    isOptNum(v['amountG']) && isOptNum(v['servings'])
  );
}

function isIngredient(v: unknown): boolean {
  return isRec(v) && isStr(v['name']) && isNum(v['amount']) && isStr(v['unit']);
}

function isRecipe(v: unknown): boolean {
  if (!isRec(v)) return false;
  const ingredients = v['ingredients'];
  return (
    isStr(v['id']) && isStr(v['title']) && isNum(v['servings']) &&
    (ingredients === undefined || (Array.isArray(ingredients) && ingredients.every(isIngredient))) &&
    (v['steps'] === undefined || Array.isArray(v['steps']))
  );
}

function isSavedMeal(v: unknown): boolean {
  if (!isRec(v)) return false;
  const entries = v['entries'];
  return (
    isStr(v['id']) && isStr(v['name']) && Array.isArray(entries) &&
    entries.every((e) => isRec(e) && isStr(e['label']) && isFacts(e['facts']))
  );
}

function isCustomFood(v: unknown): boolean {
  return isRec(v) && isStr(v['id']) && isStr(v['name']) && isFacts(v['facts']);
}

function isShoppingItem(v: unknown): boolean {
  return isRec(v) && isStr(v['name']) && isNum(v['amount']) && isStr(v['unit']) && typeof v['checked'] === 'boolean';
}

function isShoppingList(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  return isRec(v) && Array.isArray(v['items']) && v['items'].every(isShoppingItem);
}

function isWeightEntry(v: unknown): boolean {
  return isRec(v) && isStr(v['dateISO']) && ISO_DAY.test(v['dateISO']) && isNum(v['kg']) && v['kg'] >= MIN_WEIGHT_KG && v['kg'] <= MAX_WEIGHT_KG;
}

/** Gewichtsverlauf: gültige Einträge und höchstens einer je Tag. */
function isWeightList(v: unknown): boolean {
  if (!Array.isArray(v) || !v.every(isWeightEntry)) return false;
  const days = v.map((e) => (e as Rec)['dateISO']);
  return new Set(days).size === days.length;
}

function isFavorite(v: unknown): boolean {
  return isRec(v) && isStr(v['id']) && isStr(v['label']) && v['label'].trim() !== '' && isFacts(v['facts']) && isOptNum(v['amountG']) && isOptNum(v['servings']);
}

const ARRAY_CHECKS: Readonly<Record<string, (v: unknown) => boolean>> = {
  diary: isDiaryEntry,
  recipes: isRecipe,
  savedMeals: isSavedMeal,
  customFoods: isCustomFood,
  favorites: isFavorite,
};

/** True, wenn alle bekannten Datensätze vollständig und typrichtig sind. */
export function hasValidRecords(data: Rec): boolean {
  const arraysOk = Object.entries(ARRAY_CHECKS).every(
    ([key, check]) => !(key in data) || (Array.isArray(data[key]) && (data[key] as unknown[]).every(check)),
  );
  const weightOk = !('weight' in data) || isWeightList(data['weight']);
  return arraysOk && weightOk && (!('shopping' in data) || isShoppingList(data['shopping']));
}
