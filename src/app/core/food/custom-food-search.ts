import { FoodItem } from '../models';
import { CustomFood } from '../state/custom-food.store';

/** Quelle (`FoodItem.source`) für selbst eingetragene Lebensmittel. */
export const CUSTOM_SOURCE = 'custom';
const CUSTOM_ID_PREFIX = 'custom:';
/** Höchstzahl eigener Treffer in einer Suche (der Rest bleibt für Open Food Facts). */
export const MAX_CUSTOM_MATCHES = 8;
/** Anzahl zuletzt genutzter eigener Lebensmittel ohne Suchbegriff. */
export const RECENT_CUSTOM_COUNT = 5;

/** Kleinschreibung ohne Akzente, damit „Müsli“ auch bei „musli“ gefunden wird. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Wandelt ein gespeichertes eigenes Lebensmittel in einen Suchtreffer um (Basis: Portion). */
export function customToFoodItem(food: CustomFood): FoodItem {
  return { id: `${CUSTOM_ID_PREFIX}${food.id}`, source: CUSTOM_SOURCE, name: food.name, facts: food.facts };
}

export function isCustomFoodItem(item: FoodItem): boolean {
  return item.source === CUSTOM_SOURCE;
}

/** 0 = Name beginnt mit dem Begriff, 1 = ein Wort beginnt damit, 2 = enthält alle Wörter, sonst -1. */
function matchRank(name: string, query: string): number {
  if (name.startsWith(query)) return 0;
  if (name.split(' ').some((word) => word.startsWith(query))) return 1;
  const tokens = query.split(' ');
  return tokens.every((token) => name.includes(token)) ? 2 : -1;
}

/**
 * Eigene Lebensmittel, die zum Suchbegriff passen, beste Namens-Übereinstimmung zuerst
 * (bei Gleichstand die zuletzt benutzten, da der Speicher neueste zuerst liefert).
 */
export function matchCustomFoods(
  foods: readonly CustomFood[],
  query: string,
  limit: number = MAX_CUSTOM_MATCHES,
): FoodItem[] {
  const q = normalize(query);
  if (!q) return [];
  return foods
    .map((food, index) => ({ food, index, rank: matchRank(normalize(food.name), q) }))
    .filter((m) => m.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((m) => customToFoodItem(m.food));
}

/** Die zuletzt gespeicherten bzw. benutzten eigenen Lebensmittel (ohne Suchbegriff). */
export function recentCustomFoods(foods: readonly CustomFood[], limit: number = RECENT_CUSTOM_COUNT): FoodItem[] {
  return foods.slice(0, limit).map(customToFoodItem);
}
