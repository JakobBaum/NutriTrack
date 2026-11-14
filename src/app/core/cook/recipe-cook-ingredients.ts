import { RecipeIngredient } from '../models';

/** Zutat der Kochansicht (Menge wie im Rezept). */
export interface RecipeCookIngredient {
  name: string;
  amount: number;
  unit: string;
  approx?: boolean;
}

/** Zutaten eines Rezepts für den Kochmodus: getrimmte Namen, leere Zeilen entfallen. */
export function recipeCookIngredients(ingredients: readonly RecipeIngredient[]): RecipeCookIngredient[] {
  return ingredients
    .filter((i) => i.name.trim() !== '')
    .map(({ name, amount, unit, approx }) => ({ name: name.trim(), amount, unit, ...(approx ? { approx: true } : {}) }));
}
