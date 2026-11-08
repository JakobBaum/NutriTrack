import { MealType } from '../models';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';

/** Ein Rezept des Wochenplans: Online-Rezept plus Mahlzeit und eingeplante Portionen. */
export interface WeekPlanRecipe extends OnlineRecipe {
  meal: MealType;
  /** Portionen, die für `persons` eingeplant sind (eine je Person). */
  portions: number;
}

/** Wochenplan aus Online-Rezepten (persistiert unter dem Key 'week-plan'). */
export interface WeekPlan {
  id: string;
  generatedAt: string;
  persons: number;
  days: number;
  meals: MealType[];
  recipes: WeekPlanRecipe[];
  /** Hinweise zur Generierung (zu wenige Treffer, Protein gelockert). */
  notices: string[];
}
