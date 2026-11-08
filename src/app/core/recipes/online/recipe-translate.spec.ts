import { describe, expect, it } from 'vitest';
import { applyTranslation, recipeToImportText } from './recipe-translate';
import { OnlineRecipe } from './online-recipe.model';

const BASE: OnlineRecipe = {
  id: '1', title: 'Lentil Soup', servings: 2,
  ingredients: [{ name: 'lentils', amount: 200, unit: 'g' }, { name: 'onion', amount: 1, unit: 'Stk' }],
  steps: ['Chop.', 'Cook.'],
};

describe('recipeToImportText', () => {
  it('lists title, ingredient lines and steps', () => {
    expect(recipeToImportText(BASE)).toBe('Lentil Soup\n200 g lentils\n1 Stk onion\nChop.\nCook.');
  });
});

describe('applyTranslation', () => {
  it('takes texts but keeps amounts, units and servings', () => {
    const out = applyTranslation(BASE, {
      title: 'Linsensuppe', servings: 9,
      ingredients: [{ name: 'Linsen', amount: 1, unit: 'kg' }, { name: 'Zwiebel', amount: 5, unit: 'Stk' }],
      steps: ['Schneiden.', 'Kochen.'],
    });
    expect(out.title).toBe('Linsensuppe');
    expect(out.servings).toBe(2);
    expect(out.ingredients).toEqual([{ name: 'Linsen', amount: 200, unit: 'g' }, { name: 'Zwiebel', amount: 1, unit: 'Stk' }]);
    expect(out.steps).toEqual(['Schneiden.', 'Kochen.']);
  });

  it('keeps original texts when the translation is incomplete', () => {
    const out = applyTranslation(BASE, { title: '', servings: 2, ingredients: [{ name: 'Linsen', amount: 1, unit: 'g' }], steps: [] });
    expect(out.title).toBe('Lentil Soup');
    expect(out.ingredients).toEqual(BASE.ingredients);
    expect(out.steps).toEqual(BASE.steps);
  });
});
