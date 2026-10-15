import { NutritionFacts, RecipeIngredient } from '../models';

/** Einheiten, die als Gramm/Milliliter (1:1) für die Skalierung gelten. */
const GRAM_UNITS = new Set(['g', 'gramm', 'gr', 'ml', 'milliliter']);

function emptyFacts(): NutritionFacts {
  return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, basis: 'perPortion' };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Nährwerte einer einzelnen Zutat, skaliert auf ihre Menge.
 *
 * - Hat die Zutat keine hinterlegten Nährwerte, trägt sie 0 bei (manuelle Zutat).
 * - Bei Gramm-/ml-Einheiten wird über die Bezugsmenge skaliert
 *   (per100g → amount/100, perPortion → amount/portionG).
 * - Bei stückbasierten Einheiten (z.B. „Stück", „Portion") zählt `amount`
 *   als Faktor auf die Portions-Nährwerte.
 */
export function ingredientFacts(ing: RecipeIngredient): NutritionFacts {
  const facts = ing.facts;
  const amount = Number.isFinite(ing.amount) ? ing.amount : 0;
  if (!facts || amount <= 0) return emptyFacts();

  const unit = (ing.unit || 'g').trim().toLowerCase();
  let factor: number;
  if (GRAM_UNITS.has(unit)) {
    const refGrams = facts.basis === 'per100g' ? 100 : facts.portionG ?? 100;
    factor = amount / refGrams;
  } else {
    // Stück/Portion: amount ist die Anzahl der Bezugsmengen.
    factor = amount;
  }

  return {
    kcal: Math.round((facts.kcal || 0) * factor),
    proteinG: round1((facts.proteinG || 0) * factor),
    carbsG: round1((facts.carbsG || 0) * factor),
    fatG: round1((facts.fatG || 0) * factor),
    fiberG: round1((facts.fiberG || 0) * factor),
    sugarG: round1((facts.sugarG || 0) * factor),
    basis: 'perPortion',
  };
}

/** Summiert die Nährwerte aller Zutaten zu einem Gesamtwert für das Rezept. */
export function totalFacts(ingredients: RecipeIngredient[]): NutritionFacts {
  return ingredients.reduce<NutritionFacts>((acc, ing) => {
    const f = ingredientFacts(ing);
    return {
      kcal: acc.kcal + f.kcal,
      proteinG: round1(acc.proteinG + f.proteinG),
      carbsG: round1(acc.carbsG + f.carbsG),
      fatG: round1(acc.fatG + f.fatG),
      fiberG: round1((acc.fiberG ?? 0) + (f.fiberG ?? 0)),
      sugarG: round1((acc.sugarG ?? 0) + (f.sugarG ?? 0)),
      basis: 'perPortion',
    };
  }, emptyFacts());
}

/** Nährwerte je Portion = Gesamt / Portionen (mind. 1 Portion). */
export function perServingFacts(
  ingredients: RecipeIngredient[],
  servings: number,
): NutritionFacts {
  const n = Number.isFinite(servings) && servings >= 1 ? Math.floor(servings) : 1;
  const total = totalFacts(ingredients);
  return {
    kcal: Math.round(total.kcal / n),
    proteinG: round1(total.proteinG / n),
    carbsG: round1(total.carbsG / n),
    fatG: round1(total.fatG / n),
    fiberG: round1((total.fiberG ?? 0) / n),
    sugarG: round1((total.sugarG ?? 0) / n),
    basis: 'perPortion',
  };
}

/** True, wenn mindestens eine Zutat hinterlegte Nährwerte hat. */
export function hasNutrition(ingredients: RecipeIngredient[]): boolean {
  return ingredients.some((i) => !!i.facts && (i.facts.kcal || 0) > 0);
}
