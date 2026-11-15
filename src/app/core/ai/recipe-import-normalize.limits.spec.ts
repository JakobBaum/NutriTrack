import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_INGREDIENTS,
  MAX_IMPORT_INGREDIENT_CHARS,
  MAX_IMPORT_SERVINGS,
  MAX_IMPORT_STEPS,
  MAX_IMPORT_STEP_CHARS,
  MAX_IMPORT_TITLE_CHARS,
  normalizeRecipeImport,
  parseIngredientFacts,
} from './recipe-import-normalize';

describe('normalizeRecipeImport: Grenzen', () => {
  it('begrenzt Anzahl der Zutaten und Schritte', () => {
    const ingredients = Array.from({ length: MAX_IMPORT_INGREDIENTS + 25 }, (_, i) => ({ name: `Z${i}`, amount: 1, unit: 'g' }));
    const steps = Array.from({ length: MAX_IMPORT_STEPS + 25 }, (_, i) => `Schritt ${i}`);
    const result = normalizeRecipeImport({ title: 'T', ingredients, steps });
    expect(result.ingredients).toHaveLength(MAX_IMPORT_INGREDIENTS);
    expect(result.steps).toHaveLength(MAX_IMPORT_STEPS);
  });

  it('kuerzt Titel, Zutatennamen, Einheiten und Schritte', () => {
    const result = normalizeRecipeImport({
      title: 'T'.repeat(1000),
      ingredients: [{ name: 'N'.repeat(1000), amount: 1, unit: 'u'.repeat(500) }],
      steps: ['S'.repeat(20000)],
    });
    expect(result.title.length).toBe(MAX_IMPORT_TITLE_CHARS);
    expect(result.ingredients[0].name.length).toBe(MAX_IMPORT_INGREDIENT_CHARS);
    expect(result.ingredients[0].unit.length).toBeLessThanOrEqual(20);
    expect(result.steps[0].length).toBe(MAX_IMPORT_STEP_CHARS);
  });

  it('begrenzt Portionen und Mengen', () => {
    const result = normalizeRecipeImport({ title: 'T', servings: 1e6, ingredients: [{ name: 'Mehl', amount: 1e12, unit: 'g' }] });
    expect(result.servings).toBe(MAX_IMPORT_SERVINGS);
    expect(result.ingredients[0].amount).toBeLessThanOrEqual(100000);
  });

  it('uebernimmt keine Nicht-Text-Schritte (kein "[object Object]") und keine Steuerzeichen', () => {
    const result = normalizeRecipeImport({
      title: 'Ti\u0007tel\n', steps: [{ a: 1 }, null, ['x'], 'Gut\u0000 so'],
      ingredients: [{ name: { x: 1 } }, { name: 'Salz\n', amount: 1, unit: 'g' }],
    });
    expect(result.title).toBe('Ti tel');
    expect(result.steps).toEqual(['Gut so']);
    expect(result.ingredients.map((i) => i.name)).toEqual(['Salz']);
  });

  it('verwirft unplausible Naehrwerte statt sie zu uebernehmen', () => {
    expect(parseIngredientFacts({ kcal: 9999, proteinG: 1, carbsG: 1, fatG: 1, basis: 'per100g' }, 'g')).toBeUndefined();
    expect(parseIngredientFacts({ kcal: 100, proteinG: 500, carbsG: 1, fatG: 1, basis: 'per100g' }, 'g')).toBeUndefined();
    expect(parseIngredientFacts({ kcal: 1e9, proteinG: 1, carbsG: 1, fatG: 1, basis: 'perPortion' }, 'Stk')).toBeUndefined();
    expect(parseIngredientFacts({ kcal: 78, proteinG: 6.5, carbsG: 0.4, fatG: 5.5, basis: 'perPortion', portionG: 1e7 }, 'Stk')?.portionG)
      .toBeLessThanOrEqual(5000);
  });

  it('laesst plausible Naehrwerte unveraendert', () => {
    expect(parseIngredientFacts({ kcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.6 }, 'ml')?.kcal).toBe(64);
  });
});
