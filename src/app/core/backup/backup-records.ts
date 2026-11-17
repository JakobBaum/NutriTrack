/**
 * Inhaltsprüfung der Backup-Datensätze (QAE-01): Pflichtfelder und Typen, damit ein
 * beschädigtes oder fremdes Backup die Stores nicht zum Absturz bringt.
 * Dieselben Prüfungen gelten beim lokalen Laden (Stores), damit Laden nicht schwächer prüft als Import.
 */

import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../weight/weight-math';
import { isValidOnlineRef } from '../recipes/online/online-recipe-ref';
import { isIsoDay } from '../util/date';
import {
  isFactsRecord,
  isNonNegative,
  isNum,
  isOptNonNegative,
  isOptPositive,
  isPositive,
  isRec,
  isStr,
} from '../util/guards';

const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

export function isDiaryEntry(v: unknown): boolean {
  if (!isRec(v)) return false;
  return (
    isStr(v['id']) &&
    isIsoDay(v['dateISO']) &&
    isStr(v['meal']) && MEALS.has(v['meal']) &&
    isStr(v['label']) &&
    isStr(v['createdAt']) && !Number.isNaN(Date.parse(v['createdAt'])) &&
    isFactsRecord(v['facts']) &&
    isOptPositive(v['amountG']) && isOptPositive(v['servings'])
  );
}

/** Zutat: Name und Einheit als Text, Menge endlich und >= 0, Nährwerte (falls vorhanden) gültig. */
export function isIngredient(v: unknown): boolean {
  return (
    isRec(v) && isStr(v['name']) && isNonNegative(v['amount']) && isStr(v['unit']) &&
    (v['facts'] === undefined || isFactsRecord(v['facts']))
  );
}

export function isRecipe(v: unknown): boolean {
  if (!isRec(v)) return false;
  const ingredients = v['ingredients'];
  const steps = v['steps'];
  return (
    isStr(v['id']) && isStr(v['title']) && isPositive(v['servings']) &&
    (ingredients === undefined || (Array.isArray(ingredients) && ingredients.every(isIngredient))) &&
    (steps === undefined || (Array.isArray(steps) && steps.every(isStr))) &&
    (v['onlineRef'] === undefined || isValidOnlineRef(v['onlineRef']))
  );
}

const AMOUNT_UNITS = new Set(['g', 'kg', 'ml', 'l']);

/** Eintrag einer gespeicherten Mahlzeit; `isPartial` und `unit` sind optional (Altbestand ohne Felder bleibt gültig). */
function isSavedMealEntry(e: unknown): boolean {
  return (
    isRec(e) && isStr(e['label']) && isFactsRecord(e['facts']) &&
    (e['isPartial'] === undefined || typeof e['isPartial'] === 'boolean') &&
    (e['unit'] === undefined || (isStr(e['unit']) && AMOUNT_UNITS.has(e['unit'])))
  );
}

function isSavedMeal(v: unknown): boolean {
  if (!isRec(v)) return false;
  const entries = v['entries'];
  return (
    isStr(v['id']) && isStr(v['name']) && Array.isArray(entries) &&
    entries.every(isSavedMealEntry)
  );
}

function isCustomFood(v: unknown): boolean {
  return isRec(v) && isStr(v['id']) && isStr(v['name']) && isFactsRecord(v['facts']);
}

/** Einkaufsposition: Menge >= 0, Preise (falls vorhanden) >= 0, Kategorie Text, `manual` Wahrheitswert. */
export function isShoppingItem(v: unknown): boolean {
  return (
    isRec(v) && isStr(v['name']) && isNonNegative(v['amount']) && isStr(v['unit']) && typeof v['checked'] === 'boolean' &&
    isOptNonNegative(v['estPrice']) && isOptNonNegative(v['userPrice']) &&
    (v['category'] === undefined || isStr(v['category'])) &&
    (v['manual'] === undefined || typeof v['manual'] === 'boolean')
  );
}

export function isWeightEntry(v: unknown): boolean {
  return isRec(v) && isIsoDay(v['dateISO']) && isNum(v['kg']) && v['kg'] >= MIN_WEIGHT_KG && v['kg'] <= MAX_WEIGHT_KG;
}

export function isFavorite(v: unknown): boolean {
  return (
    isRec(v) && isStr(v['id']) && isStr(v['label']) && v['label'].trim() !== '' && isFactsRecord(v['facts']) &&
    isOptPositive(v['amountG']) && isOptPositive(v['servings'])
  );
}

export const ARRAY_CHECKS: Readonly<Record<string, (v: unknown) => boolean>> = {
  diary: isDiaryEntry,
  recipes: isRecipe,
  savedMeals: isSavedMeal,
  customFoods: isCustomFood,
  favorites: isFavorite,
};

