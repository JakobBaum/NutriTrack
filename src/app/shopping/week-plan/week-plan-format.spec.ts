import { describe, expect, it } from 'vitest';
import { WeekPlanRecipe } from '../../core/week-plan/week-plan.model';
import { cookIngredients, groupByMeal, recipeMetaLine } from './week-plan-format';

const base: WeekPlanRecipe = {
  id: '1', title: 'Linsen', servings: 4, steps: [], meal: 'dinner', portions: 2,
  ingredients: [{ name: ' Linsen ', amount: 200, unit: 'g' }, { name: '', amount: 1, unit: 'g' }],
};

describe('recipeMetaLine', () => {
  it('shows kcal, Eiweiß per serving, minutes and portions', () => {
    const line = recipeMetaLine({
      ...base, readyInMinutes: 30, facts: { kcal: 420, proteinG: 37.6, carbsG: 1, fatG: 1, basis: 'perPortion' },
    });
    expect(line).toBe('420 kcal · 38 g Eiweiß · 30 Min · 2 Portionen');
  });

  it('omits missing values and uses the singular', () => {
    expect(recipeMetaLine({ ...base, portions: 1 })).toBe('1 Portion');
  });
});

describe('groupByMeal', () => {
  it('orders groups breakfast to snack and drops empty ones', () => {
    const groups = groupByMeal([
      { ...base, id: 'a', meal: 'dinner' },
      { ...base, id: 'b', meal: 'breakfast' },
      { ...base, id: 'c', meal: 'dinner' },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Frühstück', 'Abend']);
    expect(groups[1].recipes.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('cookIngredients', () => {
  it('scales to persons and drops nameless ingredients', () => {
    expect(cookIngredients(base, 2)).toEqual([{ name: 'Linsen', amount: 100, unit: 'g' }]);
  });
});
