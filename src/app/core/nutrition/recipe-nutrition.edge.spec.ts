import { describe, expect, it } from 'vitest';
import { NutritionFacts, RecipeIngredient } from '../models';
import { hasNutrition, ingredientFacts, perServingFacts, totalFacts } from './recipe-nutrition';

const per100g = (kcal: number, p = 0): NutritionFacts => ({
  kcal, proteinG: p, carbsG: 0, fatG: 0, basis: 'per100g',
});
const perPortion = (kcal: number, portionG?: number): NutritionFacts => ({
  kcal, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion', portionG,
});
const ing = (over: Partial<RecipeIngredient>): RecipeIngredient => ({
  name: 'X', amount: 100, unit: 'g', ...over,
});

// Randfälle der Rezept-Nährwertrechnung (Mengen, Einheiten, Portionen).
describe('recipe-nutrition — Randfälle', () => {
  it('liefert Nullen bei Menge 0, negativ oder NaN', () => {
    for (const amount of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ingredientFacts(ing({ amount, facts: per100g(200) })).kcal).toBe(0);
    }
  });

  it('nimmt g als Standard bei leerer Einheit und ignoriert Groß-/Leerzeichen', () => {
    expect(ingredientFacts(ing({ amount: 50, unit: '', facts: per100g(200) })).kcal).toBe(100);
    expect(ingredientFacts(ing({ amount: 50, unit: ' G ', facts: per100g(200) })).kcal).toBe(100);
  });

  it('kennt alle exakten Gramm-/Milliliter-Schreibweisen', () => {
    for (const unit of ['gramm', 'gr', 'ml', 'milliliter']) {
      expect(ingredientFacts(ing({ amount: 200, unit, facts: per100g(50) })).kcal).toBe(100);
    }
    expect(ingredientFacts(ing({ amount: 1, unit: 'Liter', facts: per100g(50) })).kcal).toBe(500);
    expect(ingredientFacts(ing({ amount: 1, unit: 'Kilogramm', facts: per100g(50) })).kcal).toBe(500);
  });

  it('wandelt „Stück" auf das Stk-Näherungsgewicht (80 g) um', () => {
    expect(ingredientFacts(ing({ amount: 1, unit: 'Stück', facts: per100g(100) })).kcal).toBe(80);
  });

  it('rechnet Prise (1 g) über das Näherungsgewicht', () => {
    expect(ingredientFacts(ing({ amount: 2, unit: 'Prise', facts: per100g(400) })).kcal).toBe(8);
  });

  it('zählt eine unbekannte Einheit bei per100g als Faktor (aktuelles Verhalten)', () => {
    expect(ingredientFacts(ing({ amount: 2, unit: 'Becher', facts: per100g(100) })).kcal).toBe(200);
  });

  it('zählt bei perPortion Löffel/Stück als Anzahl Portionen', () => {
    expect(ingredientFacts(ing({ amount: 2, unit: 'EL', facts: perPortion(50, 15) })).kcal).toBe(100);
  });

  it('nimmt 100 g als Bezug bei perPortion ohne portionG', () => {
    expect(ingredientFacts(ing({ amount: 50, unit: 'g', facts: perPortion(200) })).kcal).toBe(100);
  });

  // BUG: portionG = 0 → `facts.portionG ?? 100` liefert 0 → Division durch 0.
  // recipe-nutrition.ts:39 — Eingabe: 50 g, perPortion, portionG 0; erwartet: endlich, tatsächlich: Infinity.
  it('liefert bei portionG = 0 endliche Werte', () => {
    const f = ingredientFacts(ing({ amount: 50, unit: 'g', facts: perPortion(200, 0) }));
    expect(Number.isFinite(f.kcal)).toBe(true);
  });

  it('setzt fehlende Makros auf 0 und rundet auf eine Stelle', () => {
    const facts = { kcal: 0, basis: 'per100g' } as unknown as NutritionFacts;
    const f = ingredientFacts(ing({ amount: 33, facts: { ...facts, proteinG: 10 } }));
    expect(f.proteinG).toBe(3.3);
    expect(f.carbsG).toBe(0);
    expect(f.fiberG).toBe(0);
    expect(f.sugarG).toBe(0);
  });

  it('summiert eine leere Zutatenliste zu Nullen', () => {
    expect(totalFacts([])).toEqual({
      kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, basis: 'perPortion',
    });
  });

  it('teilt durch gebrochene Portionen und fällt bei ungültigen Werten auf 1 zurück', () => {
    const items = [ing({ amount: 300, facts: per100g(100) })]; // 300 kcal
    expect(perServingFacts(items, 2.9).kcal).toBe(103);
    expect(perServingFacts(items, 0.5).kcal).toBe(600);
    expect(perServingFacts(items, 0).kcal).toBe(300);
    expect(perServingFacts(items, Number.NaN).kcal).toBe(300);
    expect(perServingFacts(items, -4).kcal).toBe(300);
    expect(perServingFacts(items, Number.POSITIVE_INFINITY).kcal).toBe(300);
  });

  it('bleibt bei sehr großen Mengen endlich', () => {
    const f = ingredientFacts(ing({ amount: 1e9, unit: 'kg', facts: per100g(900) }));
    expect(Number.isFinite(f.kcal)).toBe(true);
  });

  it('erkennt keine Nährwerte bei leerer Liste oder nur 0 kcal', () => {
    expect(hasNutrition([])).toBe(false);
    expect(hasNutrition([ing({ facts: per100g(0, 5) })])).toBe(false);
  });
});
