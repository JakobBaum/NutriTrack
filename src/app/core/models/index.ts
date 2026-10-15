/**
 * NutriTrack domain models.
 * Alle Nährwerte in Gramm (g) bzw. Kilokalorien (kcal). Datums-Strings ISO:
 *  - `dateISO`  = Kalendertag  "YYYY-MM-DD"
 *  - `*At`      = Zeitstempel  ISO 8601 "YYYY-MM-DDTHH:mm:ss.sssZ"
 */

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type NutritionBasis = 'per100g' | 'perPortion';

/** Aktivitätslevel → PAL-Faktor (siehe NutritionCalcService.ACTIVITY_FACTORS). */
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'veryActive';

/** Nutzerprofil als Basis der Bedarfsberechnung. */
export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Gewünschte Rate (kg/Woche) für lose/gain; 0 bei maintain. */
  rateKgPerWeek?: number;
  updatedAt: string;
}

/** Tägliches Ziel: Energie + Makros. */
export interface DailyTarget {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Richtwert freier Zucker (Obergrenze, WHO: < 10 % der Energie). */
  sugarG: number;
}

/** Nährwerte einer Bezugsmenge. */
export interface NutritionFacts {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saltG?: number;
  /** Bezug der Werte. */
  basis: NutritionBasis;
  /** Portionsgröße in g, falls basis = perPortion. */
  portionG?: number;
}

/** Lebensmittel aus einer Food-Quelle (Barcode/Suche). */
export interface FoodItem {
  id: string;
  /** Herkunftsprovider, z.B. "openfoodfacts". */
  source: string;
  name: string;
  brand?: string;
  barcode?: string;
  facts: NutritionFacts;
  /** Standard-Portion in g (optional). */
  servingG?: number;
  imageUrl?: string;
}

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  /** Verknüpfung zu einem FoodItem (für Nährwert-Summe), optional. */
  foodItemId?: string;
  /** Nährwerte der Zutat in ihrer Bezugsmenge (z.B. per100g aus der Food-API),
   *  Basis für die automatische Summierung. Fehlt bei manuellen Zutaten. */
  facts?: NutritionFacts;
}

export type RecipeOrigin = 'own' | 'url' | 'tiktok' | 'photo' | 'text';

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Fertig gekochtes Gesamtgewicht in g (optional, informativ). */
  cookedWeightG?: number;
  /** Nährwerte je Portion (aus den Zutaten summiert / Portionen). */
  factsPerServing?: NutritionFacts;
  origin: RecipeOrigin;
  sourceUrl?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Referenz eines Diary-Eintrags auf seine Quelle. */
export type DiaryRef =
  | { kind: 'food'; foodItemId: string }
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'manual' };

/** Ein verzehrter Posten an einem Tag. */
export interface DiaryEntry {
  id: string;
  dateISO: string;
  meal: MealType;
  label: string;
  ref: DiaryRef;
  /** Menge: Gramm ODER Portionen (je nach Quelle). */
  amountG?: number;
  servings?: number;
  /** Tatsächlich angerechnete Nährwerte (bereits skaliert). */
  facts: NutritionFacts;
  createdAt: string;
}

export interface ShoppingItem {
  name: string;
  amount: number;
  unit: string;
  checked: boolean;
  /** Geschätzter Preis in EUR (KI-Schätzung; echte Preise folgen später). */
  estPrice?: number;
}

export interface ShoppingList {
  id: string;
  dishes: number;
  persons: number;
  items: ShoppingItem[];
  /** Optional: vorgeschlagene Gerichte zur Liste. */
  suggestedDishes?: string[];
  /** Anzahl Tage des Wocheneinkaufs. */
  days?: number;
  /** Berücksichtigte Mahlzeiten (z.B. nur Abendessen). */
  meals?: MealType[];
  /** Budget-Vorgabe in EUR. */
  budget?: number;
  /** Geschätzte Gesamtkosten in EUR (Summe estPrice). */
  estTotal?: number;
  /** Gewählter Markt (z.B. "Spar"), aktuell nur informativ für Schätzpreise. */
  store?: string;
  generatedAt: string;
}

export interface FastFoodRequest {
  kcalBudget: number;
  restaurant: string;
  /** Optionales Geld-Budget in EUR. */
  moneyBudget?: number;
  /** Priorität, z.B. "high protein". */
  preference?: string;
}

export interface FastFoodSuggestion {
  restaurant: string;
  itemName: string;
  facts: NutritionFacts;
  /** Begründung, warum der Vorschlag passt. */
  rationale: string;
  /** Geschätzter Preis in EUR (optional). */
  estPrice?: number;
}

/** Konfiguration eines KI-Anbieters (lokal gespeichert). */
export interface AiConfig {
  provider: 'claude' | 'mock' | string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
}
