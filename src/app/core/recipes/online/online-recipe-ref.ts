import { Recipe } from '../../models';

/** Einzige Online-Quelle, deren Rezepte als Verweis gespeichert werden. */
export const ONLINE_SOURCE = 'spoonacular';

/** Fester Teil eines Verweises auf ein Online-Rezept (die Quelle erlaubt dauerhaft nur Id, Titel und Bild-URL). */
export interface OnlineRecipeRef {
  readonly source: typeof ONLINE_SOURCE;
  /** Id beim Anbieter. */
  readonly externalId: string;
  /** Zeitpunkt des Speicherns (ISO). */
  readonly savedAt: string;
}

/** Gespeichertes Rezept: eigenes (vollständig) oder Verweis auf ein Online-Rezept (`onlineRef` gesetzt, ohne Zutaten/Schritte). */
export type StoredRecipe = Recipe & { readonly onlineRef?: OnlineRecipeRef };

/** Verweis auf ein Online-Rezept mit `onlineRef`. */
export type OnlineRecipeRecord = Recipe & { readonly onlineRef: OnlineRecipeRef };

const EXTERNAL_ID = /^\d{1,12}$/;
/** Frühester plausibler Speicherzeitpunkt (die Online-Suche gibt es erst seit 2026). */
const MIN_SAVED_AT_MS = Date.parse('2020-01-01T00:00:00.000Z');
/** Toleranz für Uhren, die leicht vorgehen. */
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** Strikte Prüfung eines gespeicherten Verweises (Quelle, nur Ziffern als Id, plausibler Zeitpunkt). */
export function isValidOnlineRef(value: unknown, now: number = Date.now()): value is OnlineRecipeRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  if (ref['source'] !== ONLINE_SOURCE) return false;
  if (typeof ref['externalId'] !== 'string' || !EXTERNAL_ID.test(ref['externalId'])) return false;
  if (typeof ref['savedAt'] !== 'string') return false;
  const savedAt = Date.parse(ref['savedAt']);
  return Number.isFinite(savedAt) && savedAt >= MIN_SAVED_AT_MS && savedAt <= now + CLOCK_SKEW_MS;
}

export function isOnlineRef(recipe: StoredRecipe): recipe is OnlineRecipeRecord {
  return isValidOnlineRef(recipe.onlineRef);
}

/** Platzhalter für Pflichtfelder des gemeinsamen Recipe-Typs (ohne Bedeutung, bis die Details geladen sind). */
const REF_SERVINGS = 1;

/** Reduziert ein Rezept auf den Verweis: Id, Titel, Bild, Quell-Link, Zeitpunkte. */
export function toRefRecord(
  recipe: Pick<Recipe, 'id' | 'title' | 'imageUrl' | 'sourceUrl' | 'createdAt' | 'updatedAt'>,
  ref: OnlineRecipeRef,
): OnlineRecipeRecord {
  return {
    id: recipe.id,
    title: recipe.title,
    servings: REF_SERVINGS,
    ingredients: [],
    steps: [],
    origin: 'online',
    ...(recipe.sourceUrl ? { sourceUrl: recipe.sourceUrl } : {}),
    ...(recipe.imageUrl ? { imageUrl: recipe.imageUrl } : {}),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    onlineRef: ref,
  };
}

const SPOONACULAR_HOST = /(^|\.)spoonacular\.com$/;
const TRAILING_ID = /-(\d{1,12})\/?$/;

/** Id aus einem spoonacular-Link („…/lentil-soup-4242“); sonst null. */
export function spoonacularIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!SPOONACULAR_HOST.test(parsed.hostname)) return null;
    return TRAILING_ID.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

const IMAGE_PATH_ID = /^\/(?:recipes|recipeImages)\/(\d{1,12})-/;

/** Id aus einer spoonacular-Bild-Adresse („…/recipes/716429-556x370.jpg“); sonst null. */
export function spoonacularIdFromImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!SPOONACULAR_HOST.test(parsed.hostname)) return null;
    return IMAGE_PATH_ID.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function reducibleId(recipe: StoredRecipe): string | null {
  const untouched = recipe.createdAt === recipe.updatedAt;
  if (recipe.origin !== 'online' || recipe.onlineRef !== undefined || !untouched) return null;
  return spoonacularIdFromUrl(recipe.sourceUrl) ?? spoonacularIdFromImageUrl(recipe.imageUrl);
}

/**
 * Einmalige, idempotente Umstellung: vollständig gespeicherte, nie bearbeitete Online-Rezepte mit
 * wiederfindbarer Id werden zum Verweis. Alles andere bleibt unverändert (kein Datenverlust).
 */
export function migrateOnlineRecipes(list: readonly StoredRecipe[]): { recipes: StoredRecipe[]; changed: boolean } {
  let changed = false;
  const recipes = list.map((recipe) => {
    const externalId = reducibleId(recipe);
    if (externalId === null) return recipe;
    changed = true;
    return toRefRecord(recipe, { source: ONLINE_SOURCE, externalId, savedAt: recipe.createdAt });
  });
  return { recipes, changed };
}
