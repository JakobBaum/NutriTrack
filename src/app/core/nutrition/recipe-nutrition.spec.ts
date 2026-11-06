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

  it('skaliert kg und l mit Faktor 1000', () => {
    expect(ingredientFacts(ing({ amount: 1, unit: 'kg', facts: per100g(100) })).kcal).toBe(1000);
    expect(ingredientFacts(ing({ amount: 0.5, unit: 'l', facts: per100g(64) })).kcal).toBe(320);
  });

  it('rechnet EL/TL/Stk bei per100g über das Näherungsgewicht um', () => {
    expect(ingredientFacts(ing({ amount: 2, unit: 'EL', facts: per100g(400) })).kcal).toBe(120); // 30 g
    expect(ingredientFacts(ing({ amount: 3, unit: 'TL', facts: per100g(400) })).kcal).toBe(60); // 15 g
    expect(ingredientFacts(ing({ amount: 2, unit: 'Stk', facts: per100g(100) })).kcal).toBe(160); // 160 g
  });

  it('skaliert kg bei perPortion über portionG', () => {
    const f: NutritionFacts = { kcal: 70, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion', portionG: 50 };
    expect(ingredientFacts(ing({ amount: 0.1, unit: 'kg', facts: f })).kcal).toBe(140);
  });
});

describe('perServingFacts mit halben Portionen', () => {
  const items = [ing({ amount: 100, facts: per100g(500, 10) })];

  it('teilt durch 2,5 statt abgerundet durch 2', () => {
    expect(perServingFacts(items, 2.5).kcal).toBe(200);
    expect(perServingFacts(items, 2.5).proteinG).toBe(4);
  });

  it('teilt durch 0,5 (Portion verdoppelt) statt auf 1 zu klemmen', () => {
    expect(perServingFacts(items, 0.5).kcal).toBe(1000);
  });

  it('fällt bei negativ/NaN auf 1 Portion zurück', () => {
    expect(perServingFacts(items, -2).kcal).toBe(500);
    expect(perServingFacts(items, NaN).kcal).toBe(500);
  });

  it('je Portion × Portionen ergibt wieder das Gesamt (Rezeptkarte "Gesamt")', () => {
    expect(perServingFacts(items, 2.5).kcal * 2.5).toBe(totalFacts(items).kcal);
  });
});
