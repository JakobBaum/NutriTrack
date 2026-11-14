import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { containsAnyTerm, tokenizeWords } from './word-match';

/** Ob `text` einen der Begriffe als ganzes Wort (bzw. zusammenhängende Wortfolge) enthält; Groß-/Kleinschreibung egal. */
export function matchesDislike(text: string, terms: readonly string[]): boolean {
  return containsAnyTerm(tokenizeWords(text), terms);
}

/** Entfernt Rezepte, deren Titel oder Zutatennamen einen der Begriffe enthalten; ohne Begriffe dieselbe Liste. */
export function filterByDislikes<T extends Pick<OnlineRecipe, 'title' | 'ingredients'>>(
  recipes: readonly T[],
  terms: readonly string[],
): readonly T[] {
  if (!terms.some((t) => t.trim() !== '')) return recipes;
  return recipes.filter((r) => !matchesDislike(r.title, terms) && !r.ingredients.some((i) => matchesDislike(i.name, terms)));
}
