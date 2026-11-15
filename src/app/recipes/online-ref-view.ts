import { OnlineRecipe } from '../core/recipes/online/online-recipe.model';
import { servingsLabel } from './recipe-view';

/** Kennzeichen eines Online-Verweises in der Liste. */
export const ONLINE_RECIPE_LABEL = 'Online-Rezept';

/** Meta-Zeile eines Verweises: „Online-Rezept“, nach dem Laden mit Portionen und Zubereitungszeit. */
export function onlineMetaLine(loaded: OnlineRecipe | undefined): string {
  if (!loaded) return ONLINE_RECIPE_LABEL;
  const parts = [ONLINE_RECIPE_LABEL, servingsLabel(loaded.servings)];
  if (loaded.readyInMinutes) parts.push(`${loaded.readyInMinutes} Min`);
  return parts.join(' · ');
}
