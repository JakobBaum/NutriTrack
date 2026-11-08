/** Ausschnitt der Spoonacular-Antwort von `recipes/complexSearch` (nur genutzte Felder). */
export interface SpoonNutrient {
  name?: string;
  amount?: number;
  unit?: string;
}

export interface SpoonNutritionIngredient {
  id?: number;
  name?: string;
  amount?: number;
  unit?: string;
  nutrients?: SpoonNutrient[];
}

export interface SpoonMeasure {
  amount?: number;
  unitShort?: string;
  unitLong?: string;
}

export interface SpoonExtendedIngredient {
  id?: number;
  original?: string;
  name?: string;
  nameClean?: string;
  amount?: number;
  unit?: string;
  measures?: { metric?: SpoonMeasure; us?: SpoonMeasure };
}

export interface SpoonInstructionStep {
  number?: number;
  step?: string;
}

export interface SpoonInstruction {
  name?: string;
  steps?: SpoonInstructionStep[];
}

export interface SpoonRecipe {
  id?: number;
  title?: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  sourceName?: string;
  spoonacularSourceUrl?: string;
  nutrition?: { nutrients?: SpoonNutrient[]; ingredients?: SpoonNutritionIngredient[] };
  extendedIngredients?: SpoonExtendedIngredient[];
  analyzedInstructions?: SpoonInstruction[];
}

export interface SpoonSearchResponse {
  results?: SpoonRecipe[];
  offset?: number;
  number?: number;
  totalResults?: number;
}
