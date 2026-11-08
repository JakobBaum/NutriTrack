import { describe, expect, it } from 'vitest';
import { Recipe } from '../models';
import { isOnlineRecipeSaved, weekPlanToRecipes } from './week-plan-recipes';
import { WeekPlan } from './week-plan.model';

const saved = (over: Partial<Recipe>): Recipe => ({
  id: 'r1', title: 'Linsen', servings: 2, ingredients: [], steps: [], origin: 'online', createdAt: '', updatedAt: '', ...over,
});

describe('isOnlineRecipeSaved', () => {
  it('matches online recipes by title and source', () => {
    const list = [saved({ sourceUrl: 'https://a.example/x' })];
    expect(isOnlineRecipeSaved(list, { title: 'Linsen', sourceUrl: 'https://a.example/x' })).toBe(true);
    expect(isOnlineRecipeSaved(list, { title: 'Linsen', sourceUrl: 'https://b.example/y' })).toBe(false);
    expect(isOnlineRecipeSaved(list, { title: 'Reis', sourceUrl: 'https://a.example/x' })).toBe(false);
  });

  it('ignores own recipes with the same title and treats missing sources as equal', () => {
    expect(isOnlineRecipeSaved([saved({ origin: 'own' })], { title: 'Linsen' })).toBe(false);
    expect(isOnlineRecipeSaved([saved({})], { title: 'Linsen' })).toBe(true);
  });
});

describe('weekPlanToRecipes', () => {
  it('maps plan recipes to Recipe with stable, prefixed ids', () => {
    const plan: WeekPlan = {
      id: 'w', generatedAt: '2026-01-01T00:00:00.000Z', persons: 2, days: 1, meals: ['dinner'], notices: [],
      recipes: [{
        id: '42', title: 'Suppe', servings: 4, ingredients: [{ name: 'Zwiebel', amount: 1, unit: 'Stk' }], steps: ['a'],
        meal: 'dinner', portions: 2, facts: { kcal: 300, proteinG: 30, carbsG: 1, fatG: 1, basis: 'perPortion' },
      }],
    };

    const [r] = weekPlanToRecipes(plan);

    expect(r).toMatchObject({ id: 'week-42', title: 'Suppe', servings: 4, origin: 'online' });
    expect(r.factsPerServing?.proteinG).toBe(30);
  });
});
