import { MealType } from '../models';

/** Anteil des Tagesziels (kcal und Eiweiß) je Mahlzeit. */
export const MEAL_SHARE: Readonly<Record<MealType, number>> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/** Mindest-Eiweiß je Portion (g), wenn das Profil kein Proteinziel liefert. */
export const FALLBACK_MIN_PROTEIN_G: Readonly<Record<MealType, number>> = {
  breakfast: 15,
  lunch: 30,
  dinner: 30,
  snack: 10,
};

/** spoonacular-Gerichtstyp je Mahlzeit. */
export const SPOON_MEAL_TYPE: Readonly<Record<MealType, string>> = {
  breakfast: 'breakfast',
  lunch: 'main course',
  dinner: 'main course',
  snack: 'snack',
};

export const MEAL_LABELS: Readonly<Record<MealType, string>> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
};

/** Reihenfolge der Mahlzeiten im Plan. */
export const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function positive(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** Kalorien-Obergrenze je Portion einer Mahlzeit; ohne Tagesziel null (kein Limit). */
export function mealMaxCalories(dailyKcal: number | null | undefined, meal: MealType): number | null {
  return positive(dailyKcal) ? Math.round(dailyKcal * MEAL_SHARE[meal]) : null;
}

/**
 * Eiweiß-Minimum je Portion: Anteil des Tages-Proteinziels, sonst Fallback.
 * Kein fester Deckel: Das Tagesziel ist selbst auf 2,2 g/kg begrenzt, und {@link proteinSteps}
 * lockert das Minimum, wenn die Suche damit keine Treffer liefert.
 */
export function mealMinProtein(dailyProteinG: number | null | undefined, meal: MealType): number {
  const target = positive(dailyProteinG) ? Math.round(dailyProteinG * MEAL_SHARE[meal]) : FALLBACK_MIN_PROTEIN_G[meal];
  return Math.max(1, target);
}

/** Lockerungsstufen für das Eiweiß-Minimum: voll, halbiert, weggelassen (null). */
export function proteinSteps(minProtein: number): (number | null)[] {
  return [minProtein, Math.max(1, Math.round(minProtein / 2)), null];
}
