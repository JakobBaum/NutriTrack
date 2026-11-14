import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { DietSearchPrefs } from './diet-search';
import { filterByDislikes } from './dislike-filter';
import { filterByIntolerances } from './intolerance-filter';

/**
 * Blendet Rezepte aus, die zu Unverträglichkeiten oder Abneigungen des Profils passen. Das geschieht in der App
 * (nicht nur beim Anbieter), damit der Filter auch wirkt, wenn der Server einen Parameter verwirft.
 */
export function filterByDietPrefs<T extends Pick<OnlineRecipe, 'title' | 'ingredients'>>(
  recipes: readonly T[],
  prefs: Pick<DietSearchPrefs, 'intolerances' | 'dislikeTerms'>,
): readonly T[] {
  return filterByDislikes(filterByIntolerances(recipes, prefs.intolerances), prefs.dislikeTerms);
}
