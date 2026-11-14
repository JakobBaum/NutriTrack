import { describe, expect, it, vi } from 'vitest';
import { OnlineRecipe, OnlineSearchPage } from '../recipes/online/online-recipe.model';
import { OnlineSearchError } from '../recipes/online/spoonacular.errors';
import { OnlineSearchFilters } from '../recipes/online/spoonacular.query';
import { OFFSET_WINDOW, RecipeSearchFn, WeekPlanInput, buildWeekPlanRecipes, randomOffset } from './week-plan-builder';

const recipe = (id: string): OnlineRecipe => ({ id, title: `Rezept ${id}`, servings: 2, ingredients: [], steps: ['x'] });
const page = (ids: string[]): OnlineSearchPage => ({ recipes: ids.map(recipe), totalResults: 100, quotaLeft: null });
const input = (over: Partial<WeekPlanInput> = {}): WeekPlanInput => ({
  persons: 2, days: 3, meals: ['lunch', 'dinner'], dailyKcal: 2000, dailyProteinG: 150, ...over,
});

interface Call { filters: OnlineSearchFilters; offset: number; number: number }

function fakeSearch(respond: (call: Call, index: number) => OnlineSearchPage): { search: RecipeSearchFn; calls: Call[] } {
  const calls: Call[] = [];
  const search: RecipeSearchFn = async (filters, offset, number) => {
    const call = { filters, offset, number };
    calls.push(call);
    return respond(call, calls.length - 1);
  };
  return { search, calls };
}

describe('randomOffset', () => {
  it('stays inside the quality window', () => {
    expect(randomOffset(5, () => 0)).toBe(0);
    expect(randomOffset(5, () => 0.999999)).toBe(OFFSET_WINDOW - 5);
    expect(randomOffset(OFFSET_WINDOW + 10, () => 0.9)).toBe(0);
  });
});

describe('buildWeekPlanRecipes', () => {
  it('reicht die Ernährungsfilter des Profils an jede Suche durch', async () => {
    const { search, calls } = fakeSearch(() => page(['1', '2', '3']));
    const dietPrefs = { diet: 'vegan' as const, intolerances: ['soy' as const], excludeIngredients: ['mushrooms'], dislikeTerms: ['Pilze', 'mushrooms'] };

    await buildWeekPlanRecipes(search, input({ meals: ['lunch', 'dinner'], dietPrefs }), () => 0);

    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.filters).toMatchObject({ diet: 'vegan', intolerances: ['soy'], excludeIngredients: ['mushrooms'] });
    }
  });

  it('sendet ohne Ernährungsfilter weiterhin keine Ernährungsform', async () => {
    const { search, calls } = fakeSearch(() => page(['1', '2', '3']));

    await buildWeekPlanRecipes(search, input({ meals: ['dinner'] }), () => 0);

    expect(calls[0].filters.diet).toBe('');
  });

  it('entfernt Treffer mit Abneigungen im Titel oder in den Zutaten', async () => {
    const withMushroom: OnlineRecipe = { ...recipe('2'), ingredients: [{ name: 'Pilze', amount: 1, unit: 'g' }] };
    const withReis: OnlineRecipe = { ...recipe('3'), title: 'Reis-Bowl' };
    const { search } = fakeSearch(() => ({ recipes: [recipe('1'), withMushroom, withReis], totalResults: 3, quotaLeft: null }));
    const dietPrefs = { diet: '' as const, intolerances: [], excludeIngredients: [], dislikeTerms: ['Pilze', 'Ei'] };

    const { recipes } = await buildWeekPlanRecipes(search, input({ meals: ['dinner'], days: 3, dietPrefs }), () => 0);

    expect(recipes.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('filtert Unverträglichkeiten auch selbst, falls der Server den Parameter verwirft', async () => {
    const withEgg: OnlineRecipe = { ...recipe('2'), ingredients: [{ name: 'eggs', amount: 2, unit: '' }] };
    const withMilk: OnlineRecipe = { ...recipe('3'), ingredients: [{ name: 'whole milk', amount: 1, unit: 'cup' }] };
    const { search } = fakeSearch(() => ({ recipes: [recipe('1'), withEgg, withMilk], totalResults: 3, quotaLeft: null }));
    const dietPrefs = { diet: '' as const, intolerances: ['egg' as const, 'dairy' as const], excludeIngredients: [], dislikeTerms: [] };

    const { recipes } = await buildWeekPlanRecipes(search, input({ meals: ['dinner'], days: 3, dietPrefs }), () => 0);

    expect(recipes.map((r) => r.id)).toEqual(['1']);
  });

  it('sends one search per meal with type, calorie share, protein minimum and healthiness sort', async () => {
    const { search, calls } = fakeSearch((c) => page(c.filters.type === 'snack' ? ['s1', 's2', 's3'] : ['1', '2', '3']));

    await buildWeekPlanRecipes(search, input({ meals: ['breakfast', 'snack'] }), () => 0);

    expect(calls).toHaveLength(2);
    expect(calls[0].filters).toMatchObject({ type: 'breakfast', maxCalories: 500, minProtein: 38, sort: 'healthiness' });
    expect(calls[1].filters).toMatchObject({ type: 'snack', maxCalories: 200, minProtein: 15, sort: 'healthiness' });
    expect(calls[0].number).toBe(3);
  });

  it('omits maxCalories without a daily target and uses fallback protein', async () => {
    const { search, calls } = fakeSearch(() => page(['1', '2', '3']));

    await buildWeekPlanRecipes(search, input({ meals: ['dinner'], dailyKcal: null, dailyProteinG: null }), () => 0);

    expect(calls[0].filters.maxCalories).toBeNull();
    expect(calls[0].filters.minProtein).toBe(30);
  });

  it('tags recipes with meal and planned portions in meal order', async () => {
    const { search } = fakeSearch((c) => page(c.filters.type === 'breakfast' ? ['b1', 'b2', 'b3'] : ['m1', 'm2', 'm3']));

    const { recipes, notices } = await buildWeekPlanRecipes(search, input({ meals: ['lunch', 'breakfast'], persons: 4 }), () => 0);

    expect(recipes.map((r) => r.meal)).toEqual(['breakfast', 'breakfast', 'breakfast', 'lunch', 'lunch', 'lunch']);
    expect(recipes.every((r) => r.portions === 4)).toBe(true);
    expect(notices).toEqual([]);
  });

  it('never plans the same recipe twice across meals sharing a type', async () => {
    const { search, calls } = fakeSearch((_c, i) => page(i === 0 ? ['1', '2', '3'] : ['2', '3', '4', '5', '6', '7']));

    const { recipes } = await buildWeekPlanRecipes(search, input(), () => 0);

    const ids = recipes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(calls[1].number).toBe(6);
  });

  it('caps the request size at the worker limit', async () => {
    const { search, calls } = fakeSearch(() => page(['1']));

    await buildWeekPlanRecipes(search, input({ days: 14 }), () => 0);

    expect(calls.every((c) => c.number <= 20)).toBe(true);
  });

  it('relaxes the protein minimum step by step and reports it', async () => {
    const { search, calls } = fakeSearch((c) => page(c.filters.minProtein === null ? ['1', '2', '3'] : []));

    const { recipes, notices } = await buildWeekPlanRecipes(search, input({ meals: ['dinner'] }), () => 0);

    expect(recipes).toHaveLength(3);
    expect(calls.map((c) => c.filters.minProtein)).toEqual([45, 23, null]);
    expect(notices).toEqual(['Abend: weniger Eiweiß als Ziel (ohne Mindestwert).']);
  });

  it('stops relaxing as soon as enough recipes are found', async () => {
    const { search, calls } = fakeSearch((c) => page(c.filters.minProtein === 45 ? [] : ['1', '2', '3']));

    const { notices } = await buildWeekPlanRecipes(search, input({ meals: ['dinner'] }), () => 0);

    expect(calls).toHaveLength(2);
    expect(notices).toEqual(['Abend: weniger Eiweiß als Ziel (mind. 23 g).']);
  });

  it('plans with what exists and notes the shortage', async () => {
    const { search } = fakeSearch(() => page(['1', '2']));

    const { recipes, notices } = await buildWeekPlanRecipes(search, input({ meals: ['dinner'] }), () => 0);

    expect(recipes).toHaveLength(2);
    expect(notices).toContain('Abend: nur 2 von 3 Rezepten gefunden.');
  });

  it('retries from the start when the random offset lies behind the last hit', async () => {
    const { search, calls } = fakeSearch((c) => page(c.offset > 0 ? [] : ['1', '2', '3']));

    const { recipes } = await buildWeekPlanRecipes(search, input({ meals: ['dinner'] }), () => 0.5);

    expect(calls.map((c) => c.offset)).toEqual([24, 0]);
    expect(recipes).toHaveLength(3);
  });

  it('propagates search errors unchanged', async () => {
    const error = new OnlineSearchError('quota', 'Limit');
    const search = vi.fn().mockRejectedValue(error);

    await expect(buildWeekPlanRecipes(search, input(), () => 0)).rejects.toBe(error);
  });
});
