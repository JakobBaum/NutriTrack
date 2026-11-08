import { FoodItem } from '../models';
import { CustomFood } from '../state/custom-food.store';
import { matchCustomFoods } from './custom-food-search';

/** Minimale Textsuche, die eine Quelle (z. B. Open Food Facts) anbietet. */
export interface FoodTextSource {
  searchByText(query: string): Promise<FoodItem[]>;
}

/**
 * Gemeinsame Suche: eigene Lebensmittel (lokal, immer verfügbar) stehen vor den Treffern
 * der Online-Quelle. Fällt die Online-Quelle aus, bleiben passende eigene Treffer sichtbar;
 * ohne eigene Treffer wird der Fehler an die Suche weitergereicht.
 */
export function withCustomFoods(remote: FoodTextSource, customs: () => readonly CustomFood[]): FoodTextSource {
  return {
    async searchByText(query: string): Promise<FoodItem[]> {
      const own = matchCustomFoods(customs(), query);
      try {
        return [...own, ...(await remote.searchByText(query))];
      } catch (error: unknown) {
        if (own.length > 0) return own;
        throw error;
      }
    },
  };
}
