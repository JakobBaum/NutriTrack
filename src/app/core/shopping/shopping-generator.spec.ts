import { describe, expect, it } from 'vitest';
import { buildShoppingList } from './shopping-generator';
import { Recipe } from '../models';

function recipe(partial: Partial<Recipe>): Recipe {
  return {
    id: 'r1',
    title: 'Test',
    servings: 2,
    ingredients: [],
    steps: [],
    origin: 'own',
    createdAt: '2026-10-13T00:00:00.000Z',
    updatedAt: '2026-10-13T00:00:00.000Z',
    ...partial,
  };
}

describe('buildShoppingList', () => {
  it('erzeugt eine Basis-Liste (pro Person skaliert), wenn keine Rezepte da sind', () => {
    const { items, suggestedDishes } = buildShoppingList([], 3, 2);
    expect(suggestedDishes).toEqual([]);
    expect(items.length).toBeGreaterThan(0);
    const nudeln = items.find((i) => i.name === 'Nudeln');
    // 125 g pro Person × 2 Personen = 250 g
    expect(nudeln?.amount).toBe(250);
    expect(items.every((i) => i.checked === false)).toBe(true);
  });

  it('skaliert Zutaten auf die Personenzahl (persons / servings)', () => {
    const r = recipe({
      servings: 2,
      ingredients: [{ name: 'Mehl', amount: 200, unit: 'g' }],
    });
    // 4 Personen / 2 Portionen = Faktor 2 → 400 g
    const { items } = buildShoppingList([r], 1, 4);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Mehl', amount: 400, unit: 'g' });
  });

  it('fasst gleiche Positionen (Name + Einheit) über Rezepte zusammen', () => {
    const r1 = recipe({ id: 'a', title: 'A', servings: 1, ingredients: [{ name: 'Zwiebel', amount: 1, unit: 'Stk' }] });
    const r2 = recipe({ id: 'b', title: 'B', servings: 1, ingredients: [{ name: 'zwiebel', amount: 2, unit: 'stk' }] });
    const { items, suggestedDishes } = buildShoppingList([r1, r2], 2, 1);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(3);
    expect(suggestedDishes).toEqual(['A', 'B']);
  });

  it('begrenzt die Rezeptauswahl auf die Anzahl Gerichte', () => {
    const recipes = [
      recipe({ id: 'a', title: 'A', ingredients: [{ name: 'A-Zutat', amount: 1, unit: 'g' }] }),
      recipe({ id: 'b', title: 'B', ingredients: [{ name: 'B-Zutat', amount: 1, unit: 'g' }] }),
      recipe({ id: 'c', title: 'C', ingredients: [{ name: 'C-Zutat', amount: 1, unit: 'g' }] }),
    ];
    const { suggestedDishes } = buildShoppingList(recipes, 2, 1);
    expect(suggestedDishes).toEqual(['A', 'B']);
  });

  it('erzwingt Mindestwerte von 1 für Gerichte und Personen', () => {
    const { items } = buildShoppingList([], 0, 0);
    const nudeln = items.find((i) => i.name === 'Nudeln');
    expect(nudeln?.amount).toBe(125); // 1 Person
  });
});
