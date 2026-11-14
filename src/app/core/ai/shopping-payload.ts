import type { ShoppingPlanRequest } from './ai-provider';

/** Der Worker liest höchstens so viele Rezepttitel (worker.js recipeNames). */
export const MAX_PAYLOAD_RECIPES = 30;

/** Was bei der Einkaufsliste an den Worker geht: Wünsche und nur die Titel der Rezepte. */
export interface ShoppingPayload extends Omit<ShoppingPlanRequest, 'recipes'> {
  recipes: { title: string }[];
}

export function buildShoppingPayload(req: ShoppingPlanRequest): ShoppingPayload {
  return { ...req, recipes: req.recipes.slice(0, MAX_PAYLOAD_RECIPES).map((r) => ({ title: r.title })) };
}
