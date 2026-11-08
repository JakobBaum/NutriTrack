import { Recipe } from '../models';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { WeekPlan } from './week-plan.model';

/** Wochenplan-Rezepte als Recipe[] (für buildShoppingList); ohne eigene Id im RecipeStore. */
export function weekPlanToRecipes(plan: WeekPlan): Recipe[] {
  return plan.recipes.map((r) => ({
    id: `week-${r.id}`,
    title: r.title,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    origin: 'online',
    sourceUrl: r.sourceUrl,
    imageUrl: r.imageUrl,
    factsPerServing: r.facts,
    createdAt: plan.generatedAt,
    updatedAt: plan.generatedAt,
  }));
}

/** True, wenn das Online-Rezept schon als Favorit (origin 'online', gleicher Titel und Quelle) gespeichert ist. */
export function isOnlineRecipeSaved(saved: readonly Recipe[], recipe: Pick<OnlineRecipe, 'title' | 'sourceUrl'>): boolean {
  return saved.some(
    (r) => r.origin === 'online' && r.title === recipe.title && (r.sourceUrl ?? '') === (recipe.sourceUrl ?? ''),
  );
}
