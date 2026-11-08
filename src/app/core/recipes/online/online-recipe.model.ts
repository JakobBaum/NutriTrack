import { NutritionFacts, RecipeIngredient } from '../../models';

/** Rezept aus der Online-Suche in App-Form (noch nicht gespeichert). */
export interface OnlineRecipe {
  /** Id beim Anbieter (nur für Duplikat-Erkennung). */
  id: string;
  title: string;
  imageUrl?: string;
  readyInMinutes?: number;
  /** Ganze Portionen, mindestens 1. */
  servings: number;
  sourceName?: string;
  sourceUrl?: string;
  /** Nährwerte je Portion, falls der Anbieter sie liefert. */
  facts?: NutritionFacts;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface OnlineSearchPage {
  recipes: OnlineRecipe[];
  totalResults: number;
  /** Verbleibende Tagespunkte (Header X-Api-Quota-Left), falls geliefert. */
  quotaLeft: number | null;
}
