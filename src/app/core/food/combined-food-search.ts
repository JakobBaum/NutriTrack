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
 * ohne eigene Treffer wird der Fehler an die Suche weitergereicht. `onRemoteStatus(true)` meldet, dass die
 * Online-Quelle ausgefallen ist, aber eigene Treffer gezeigt werden (F6): die Liste ist dann unvollständig.
 */
export function withCustomFoods(
  remote: FoodTextSource,
  customs: () => readonly CustomFood[],
  onRemoteStatus?: (failed: boolean) => void,
): FoodTextSource {
  return {
    async searchByText(query: string): Promise<FoodItem[]> {
      const own = matchCustomFoods(customs(), query);
      try {
        const online = await remote.searchByText(query);
        onRemoteStatus?.(false);
        return [...own, ...online];
      } catch (error: unknown) {
        if (own.length === 0) throw error;
        onRemoteStatus?.(true);
        return own;
      }
    },
  };
}
