import { describe, expect, it } from 'vitest';
import { ingredientFacts, perServingFacts } from '../../nutrition/recipe-nutrition';
import { factsFromNutrients, mapAmountUnit, mapSpoonRecipe, toRecipeDraft } from './spoonacular.mapper';
import { SpoonRecipe } from './spoonacular.types';

const RAW: SpoonRecipe = {
  id: 7, title: ' Lentil Soup ', image: 'https://img.example/7.jpg', readyInMinutes: 30, servings: 2,
  sourceUrl: 'https://blog.example/soup', sourceName: 'Blog',
  nutrition: {
    nutrients: [
      { name: 'Calories', amount: 350.4 }, { name: 'Protein', amount: 20.04 }, { name: 'Fat', amount: 5 },
      { name: 'Carbohydrates', amount: 50 }, { name: 'Fiber', amount: 12 }, { name: 'Sodium', amount: 400 },
    ],
    ingredients: [
      { id: 1, name: 'lentils', amount: 200, unit: 'g', nutrients: [{ name: 'Calories', amount: 600 }, { name: 'Protein', amount: 40 }] },
      { id: 2, name: 'garlic', amount: 2, unit: 'cloves', nutrients: [{ name: 'Calories', amount: 8 }, { name: 'Protein', amount: 0.4 }] },
    ],
  },
  extendedIngredients: [
    { id: 1, name: 'lentils', nameClean: 'red lentils', amount: 1, unit: 'cup', measures: { metric: { amount: 200, unitShort: 'g' } } },
    { id: 2, name: 'garlic', amount: 2, unit: 'cloves', measures: { metric: { amount: 2, unitShort: 'cloves' } } },
  ],
  analyzedInstructions: [{ steps: [{ step: ' Chop. ' }, { step: 'Cook.' }, { step: '' }] }],
};

describe('mapAmountUnit', () => {
  it('prefers metric g/ml', () => {
    expect(mapAmountUnit({ amount: 1, unit: 'cup', measures: { metric: { amount: 236.59, unitShort: 'ml' } } })).toEqual({ amount: 237, unit: 'ml' });
  });

  it('maps english units and empty units to app units', () => {
    expect(mapAmountUnit({ amount: 2, unit: 'tbsp' })).toEqual({ amount: 2, unit: 'EL' });
    expect(mapAmountUnit({ amount: 3, unit: '' })).toEqual({ amount: 3, unit: 'Stk' });
  });

  it('converts ounces to grams', () => {
    expect(mapAmountUnit({ amount: 2, unit: 'oz' })).toEqual({ amount: 57, unit: 'g' });
  });
});

describe('factsFromNutrients', () => {
  it('maps per serving facts and converts sodium to salt', () => {
    const f = factsFromNutrients(RAW.nutrition?.nutrients);
    expect(f).toMatchObject({ kcal: 350, proteinG: 20, fatG: 5, carbsG: 50, fiberG: 12, saltG: 1, basis: 'perPortion' });
  });

  it('returns undefined without calories', () => {
    expect(factsFromNutrients([{ name: 'Fat', amount: 3 }])).toBeUndefined();
    expect(factsFromNutrients(undefined)).toBeUndefined();
  });
});

describe('mapSpoonRecipe', () => {
  it('maps title, servings, steps, source and ingredients', () => {
    const r = mapSpoonRecipe(RAW)!;
    expect(r.title).toBe('Lentil Soup');
    expect(r.servings).toBe(2);
    expect(r.steps).toEqual(['Chop.', 'Cook.']);
    expect(r.sourceUrl).toBe('https://blog.example/soup');
    expect(r.ingredients.map((i) => [i.name, i.amount, i.unit])).toEqual([['red lentils', 200, 'g'], ['garlic', 2, 'Zehe']]);
  });

  it('gives ingredient facts that reproduce the ingredient nutrition', () => {
    const r = mapSpoonRecipe(RAW)!;
    expect(ingredientFacts(r.ingredients[0]).kcal).toBe(600);
    expect(ingredientFacts(r.ingredients[1]).kcal).toBe(8);
    expect(perServingFacts(r.ingredients, r.servings).kcal).toBe(304);
  });

  it('rejects results without id or title and clamps servings', () => {
    expect(mapSpoonRecipe({ title: 'x' })).toBeNull();
    expect(mapSpoonRecipe({ id: 1, title: '  ' })).toBeNull();
    expect(mapSpoonRecipe({ id: 1, title: 'x', servings: 0 })?.servings).toBe(1);
  });

  it('drops non-http image and source urls', () => {
    const r = mapSpoonRecipe({ id: 1, title: 'x', image: 'javascript:alert(1)', sourceUrl: 'javascript:alert(1)' })!;
    expect(r.imageUrl).toBeUndefined();
    expect(r.sourceUrl).toBeUndefined();
  });
});

describe('toRecipeDraft', () => {
  it('creates an online-origin draft with per-serving facts', () => {
    const draft = toRecipeDraft(mapSpoonRecipe(RAW)!);
    expect(draft.origin).toBe('online');
    expect(draft.factsPerServing?.kcal).toBe(350);
    expect(draft.steps).toHaveLength(2);
  });
});
