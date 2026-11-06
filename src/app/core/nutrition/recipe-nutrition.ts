import { NutritionFacts, RecipeIngredient } from '../models';
import { unitGrams } from './units-weight';

/** Einheiten mit exaktem Gewicht (Gramm je Einheit) für die Skalierung. */
const EXACT_UNIT_G: Readonly<Record<string, number>> = {
  g: 1, gramm: 1, gr: 1, kg: 1000, kilogramm: 1000,
  ml: 1, milliliter: 1, l: 1000, liter: 1000,
};

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
 * - Bei g/ml/kg/l wird über die Bezugsmenge skaliert
 *   (per100g → amount/100, perPortion → amount/portionG).
 * - Bei Stück-/Löffel-Einheiten: per100g über das Näherungsgewicht (EL = 15 g …),
 *   perPortion zählt `amount` als Faktor auf die Portions-Nährwerte.
 */
export function ingredientFacts(ing: RecipeIngredient): NutritionFacts {
  const facts = ing.facts;
  const amount = Number.isFinite(ing.amount) ? ing.amount : 0;
  if (!facts || amount <= 0) return emptyFacts();

  const unit = (ing.unit || 'g').trim().toLowerCase();
  let factor: number;
  const exactG = EXACT_UNIT_G[unit];
  const portionG = facts.portionG;
  const validPortion = portionG !== undefined && Number.isFinite(portionG) && portionG > 0;
  const refGrams = facts.basis === 'per100g' ? 100 : validPortion ? portionG : 100;
  if (exactG !== undefined) {
    factor = (amount * exactG) / refGrams;
  } else if (facts.basis === 'per100g') {
    // EL, TL, Stk …: Menge über das Näherungsgewicht in Gramm umrechnen.
    const approxG = unitGrams(unit, ing.name);
    factor = approxG !== undefined ? (amount * approxG) / refGrams : amount;
  } else {
    // perPortion: amount ist die Anzahl der Bezugsmengen.
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

/** Nährwerte je Portion = Gesamt / Portionen (auch halbe Portionen; ungültig → 1). */
export function perServingFacts(
  ingredients: RecipeIngredient[],
  servings: number,
): NutritionFacts {
  const n = Number.isFinite(servings) && servings > 0 ? servings : 1;
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
