import { describe, expect, it } from 'vitest';
import { NutritionFacts, RecipeIngredient } from '../models';
import { ingredientFacts, totalFacts, perServingFacts, hasNutrition } from './recipe-nutrition';

const per100g = (kcal: number, p = 0, c = 0, f = 0): NutritionFacts => ({
  kcal,
  proteinG: p,
  carbsG: c,
  fatG: f,
  basis: 'per100g',
});

const ing = (over: Partial<RecipeIngredient>): RecipeIngredient => ({
  name: 'X',
  amount: 100,
  unit: 'g',
  ...over,
});

describe('recipe-nutrition', () => {
  it('skaliert per100g-Nährwerte auf die Gramm-Menge', () => {
    // Arrange: 200 g Reis mit 130 kcal/100g
    const rice = ing({ amount: 200, unit: 'g', facts: per100g(130, 2.7, 28, 0.3) });

    // Act
    const f = ingredientFacts(rice);

    // Assert
    expect(f.kcal).toBe(260);
    expect(f.carbsG).toBe(56);
  });

  it('zählt manuelle Zutaten ohne Nährwerte als 0', () => {
    expect(ingredientFacts(ing({ name: 'Salz', facts: undefined })).kcal).toBe(0);
  });

  it('behandelt Stück-Einheiten als Faktor auf die Bezugsmenge', () => {
    const egg = ing({ amount: 2, unit: 'Stück', facts: { kcal: 70, proteinG: 6, carbsG: 0, fatG: 5, basis: 'perPortion' } });
    expect(ingredientFacts(egg).kcal).toBe(140);
    expect(ingredientFacts(egg).proteinG).toBe(12);
  });

  it('summiert mehrere Zutaten zum Gesamtwert', () => {
    const items = [
      ing({ amount: 200, unit: 'g', facts: per100g(130, 2.7, 28) }), // 260 kcal
      ing({ amount: 100, unit: 'g', facts: per100g(52, 0.3, 14) }), // 52 kcal
    ];
    expect(totalFacts(items).kcal).toBe(312);
    expect(totalFacts(items).carbsG).toBe(70);
  });

  it('teilt den Gesamtwert durch die Portionen', () => {
    const items = [ing({ amount: 400, unit: 'g', facts: per100g(130) })]; // 520 kcal total
    expect(perServingFacts(items, 4).kcal).toBe(130);
  });

  it('nutzt mindestens 1 Portion (keine Division durch 0)', () => {
    const items = [ing({ amount: 100, unit: 'g', facts: per100g(200) })];
    expect(perServingFacts(items, 0).kcal).toBe(200);
  });

  it('erkennt, ob überhaupt Nährwerte vorhanden sind', () => {
    expect(hasNutrition([ing({ facts: per100g(100) })])).toBe(true);
    expect(hasNutrition([ing({ facts: undefined })])).toBe(false);
  });
});
