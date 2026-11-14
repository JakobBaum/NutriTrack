import { describe, expect, it } from 'vitest';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { filterByDietPrefs } from './diet-filter';

const recipe = (id: string, title: string, ingredients: string[]): OnlineRecipe => ({
  id, title, servings: 2, steps: [], ingredients: ingredients.map((name) => ({ name, amount: 1, unit: 'g' })),
});

describe('filterByDietPrefs', () => {
  const list = [recipe('1', 'Soup', ['lentils']), recipe('2', 'Omelette', ['eggs']), recipe('3', 'Mushroom pasta', ['mushrooms'])];

  it('wendet Unverträglichkeiten und Abneigungen gemeinsam an', () => {
    const result = filterByDietPrefs(list, { intolerances: ['egg'], dislikeTerms: ['mushrooms'] });
    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  it('lässt ohne Angaben alles durch', () => {
    expect(filterByDietPrefs(list, { intolerances: [], dislikeTerms: [] })).toEqual(list);
  });
});
