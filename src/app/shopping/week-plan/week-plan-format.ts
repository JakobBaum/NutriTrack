import { MealType } from '../../core/models';
import { CookIngredient } from '../../shared/cook-mode/cook-mode.component';
import { MEAL_LABELS, MEAL_ORDER } from '../../core/week-plan/week-plan-targets';
import { WeekPlanRecipe } from '../../core/week-plan/week-plan.model';
import { scaleRecipeIngredients } from '../shopping-list.util';

export interface MealGroup {
  meal: MealType;
  label: string;
  recipes: WeekPlanRecipe[];
}

/** Zahl mit Dezimalkomma („12,5“). */
function de(n: number): string {
  return String(n).replace('.', ',');
}

/** „320 kcal · 38 g Eiweiß · 30 Min · 2 Portionen“ (fehlende Werte entfallen). */
export function recipeMetaLine(r: WeekPlanRecipe): string {
  const parts: string[] = [];
  if (r.facts) parts.push(`${de(r.facts.kcal)} kcal`, `${de(Math.round(r.facts.proteinG))} g Eiweiß`);
  if (r.readyInMinutes) parts.push(`${r.readyInMinutes} Min`);
  parts.push(r.portions === 1 ? '1 Portion' : `${r.portions} Portionen`);
  return parts.join(' · ');
}

/** Rezepte nach Mahlzeit gruppiert (Reihenfolge Frühstück bis Snack, leere Gruppen entfallen). */
export function groupByMeal(recipes: readonly WeekPlanRecipe[]): MealGroup[] {
  return MEAL_ORDER.map((meal) => ({
    meal,
    label: MEAL_LABELS[meal],
    recipes: recipes.filter((r) => r.meal === meal),
  })).filter((g) => g.recipes.length > 0);
}

/** Zutaten für die Kochansicht, auf die Personenzahl skaliert. */
export function cookIngredients(recipe: WeekPlanRecipe, persons: number): CookIngredient[] {
  const named = recipe.ingredients.filter((i) => i.name.trim() !== '');
  return scaleRecipeIngredients(recipe, persons).map(({ name, amount, unit }, i) => ({
    name,
    amount,
    unit,
    ...(named[i]?.approx ? { approx: true } : {}),
  }));
}
