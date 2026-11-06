import { describe, expect, it } from 'vitest';
import { buildShoppingList, buildWeekPlan } from './shopping-generator';
import { Recipe } from '../models';

function recipe(partial: Partial<Recipe>): Recipe {
  return {
    id: 'r1', title: 'Test', servings: 2, ingredients: [], steps: [], origin: 'own',
    createdAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z',
    ...partial,
  };
}

describe('buildShoppingList / buildWeekPlan — Randfälle', () => {
  it('rundet die Gerichteanzahl ab', () => {
    const recipes = [recipe({ title: 'A' }), recipe({ title: 'B' }), recipe({ title: 'C' })];
    expect(buildShoppingList(recipes, 2.9, 1).suggestedDishes).toEqual(['A', 'B']);
  });

  it('behandelt servings 0 wie 1 Portion', () => {
    const r = recipe({ servings: 0, ingredients: [{ name: 'Mehl', amount: 100, unit: 'g' }] });
    expect(buildShoppingList([r], 1, 2).items[0].amount).toBe(200);
  });

  it('führt Namen trotz Groß-/Leerzeichen zusammen', () => {
    const r = recipe({
      servings: 1,
      ingredients: [
        { name: ' Mehl ', amount: 100, unit: 'g' },
        { name: 'mehl', amount: 50, unit: ' G' },
      ],
    });
    const { items } = buildShoppingList([r], 1, 1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Mehl', amount: 150, unit: 'g', checked: false });
  });

  it('nutzt mindestens 1 Mahlzeit pro Tag und nennt Gerichte nur einmal', () => {
    const r = recipe({ title: 'A', servings: 1, ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }] });
    const plan = buildWeekPlan([r], 1, 3, 0);
    expect(plan.items[0].amount).toBe(300);
    expect(plan.suggestedDishes).toEqual(['A']);
  });

  // BUG: Math.max(1, NaN) = NaN → alle Mengen NaN.
  // shopping-generator.ts:88 — Eingabe: persons NaN; erwartet: wie 1 Person, tatsächlich: NaN.
  it('behandelt NaN-Personen wie 1 Person', () => {
    const r = recipe({ servings: 1, ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }] });
    expect(buildWeekPlan([r], Number.NaN, 1, 1).items[0].amount).toBe(100);
  });
});
