import { describe, expect, it } from 'vitest';
import { buildShoppingList, buildWeekPlan, estimatePrice, priceItems } from './shopping-generator';
import { Recipe, ShoppingItem } from '../models';

const item = (amount: number, unit: string): ShoppingItem => ({ name: 'X', amount, unit, checked: false });

function recipe(partial: Partial<Recipe>): Recipe {
  return {
    id: 'r1', title: 'Test', servings: 2, ingredients: [], steps: [], origin: 'own',
    createdAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z',
    ...partial,
  };
}

// Randfälle der lokalen Preis-Schätzung.
describe('estimatePrice — Randfälle', () => {
  it('rechnet je Einheit', () => {
    expect(estimatePrice(item(250, 'g'))).toBe(1);
    expect(estimatePrice(item(2, 'kg'))).toBe(8);
    expect(estimatePrice(item(500, 'ml'))).toBe(1.5);
    expect(estimatePrice(item(1.5, 'l'))).toBe(3.75);
    expect(estimatePrice(item(3, ' Stück '))).toBe(1.8);
    expect(estimatePrice(item(2, 'Zehe'))).toBe(0.2);
    expect(estimatePrice(item(1, 'Bund'))).toBe(0.5);
  });

  it('setzt einen Mindestpreis von 0,10 € bei 0 oder negativen Mengen', () => {
    expect(estimatePrice(item(0, 'g'))).toBe(0.1);
    expect(estimatePrice(item(-5, 'kg'))).toBe(0.1);
  });

  it('wendet den Marktfaktor unabhängig von Groß-/Leerzeichen an', () => {
    expect(estimatePrice(item(250, 'g'), ' LIDL ')).toBe(0.9);
    expect(estimatePrice(item(250, 'g'), 'Spar')).toBe(1.08);
    expect(estimatePrice(item(250, 'g'), 'Unbekannt')).toBe(1);
    expect(estimatePrice(item(250, 'g'), '')).toBe(1);
  });

  it('bleibt bei großen Mengen endlich', () => {
    expect(estimatePrice(item(1e9, 'g'))).toBe(4e6);
  });

  // BUG: Math.max(0.1, NaN) = NaN → Position bekommt NaN-Preis.
  // shopping-generator.ts:171 — Eingabe: amount NaN; erwartet: 0,1 €, tatsächlich: NaN.
  it('liefert bei NaN-Menge den Mindestpreis', () => {
    expect(estimatePrice(item(Number.NaN, 'g'))).toBe(0.1);
  });
});

describe('priceItems — Randfälle', () => {
  it('liefert 0 € für eine leere Liste', () => {
    expect(priceItems([])).toEqual({ items: [], estTotal: 0 });
  });

  it('verändert die Eingabe nicht', () => {
    const input = [item(250, 'g')];
    const { items } = priceItems(input, 'Hofer');
    expect(input[0].estPrice).toBeUndefined();
    expect(items[0].estPrice).toBe(0.9);
  });
});

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
