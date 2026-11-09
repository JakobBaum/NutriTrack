import { describe, expect, it } from 'vitest';
import { Recipe } from '../models';
import { displayName, nameKey } from './ingredient-name';
import { normalizeIngredient } from './normalize-ingredient';
import { buildShoppingList } from './shopping-generator';
import { MAX_PIECE_COUNT, spiceUnitFor } from './spice-rules';

const recipe = (id: string, ingredients: Recipe['ingredients'], servings = 2): Recipe => ({
  id, title: id, servings, ingredients, steps: [], origin: 'online', createdAt: '', updatedAt: '',
});

describe('spiceUnitFor', () => {
  it('ordnet Kräuter, Gewürze und Töpfe den Kaufeinheiten zu', () => {
    expect(spiceUnitFor('Rosmarin')).toBe('Pck');
    expect(spiceUnitFor('Rosmarin, frisch')).toBe('Bund');
    expect(spiceUnitFor('Basilikum')).toBe('Topf');
    expect(spiceUnitFor('Salz')).toBe('Pck');
    expect(spiceUnitFor('Paprikapulver')).toBe('Pck');
    expect(spiceUnitFor('Kreuzkümmel')).toBe('Pck');
    expect(spiceUnitFor('Zimt')).toBe('Pck');
  });

  it('lässt normale Zutaten in Ruhe', () => {
    expect(spiceUnitFor('Zwiebel')).toBeNull();
    expect(spiceUnitFor('Paprika')).toBeNull();
    expect(spiceUnitFor('Schweinefleisch')).toBeNull();
  });
});

describe('normalizeIngredient', () => {
  it('summiert Gewürze und Kräuter nie als Stück: 10 Zweige Rosmarin = 1 Bund', () => {
    expect(normalizeIngredient('rosemary', 10, 'Stk')).toMatchObject({ name: 'Rosemary', amount: 1, spice: true });
    expect(normalizeIngredient('Rosmarin, frisch', 10, 'Stk')).toEqual({ name: 'Rosmarin, frisch', amount: 1, unit: 'Bund', spice: true });
    expect(normalizeIngredient('Salz', 2, 'TL')).toMatchObject({ amount: 1, unit: 'Pck', spice: true });
  });

  it('rechnet US-Maße um: 2 pounds pork -> 900 g', () => {
    const out = normalizeIngredient('Schweinefleisch', 2, 'lb');
    expect(out.unit).toBe('g');
    expect(out.amount).toBeCloseTo(907.2, 0);
  });

  it('rechnet Knoblauchzehen in Knollen und begrenzt absurde Stückzahlen', () => {
    expect(normalizeIngredient('Knoblauch', 3, 'Zehe')).toMatchObject({ name: 'Knoblauch', amount: 1, unit: 'Stk' });
    expect(normalizeIngredient('Knoblauch', 25, 'Zehe')).toMatchObject({ amount: 3, unit: 'Stk' });
    expect(normalizeIngredient('Zwiebel', 400, 'Stk').amount).toBe(MAX_PIECE_COUNT);
  });

  it('rechnet EL/TL in ml', () => {
    const out = normalizeIngredient('Olivenöl', 2, 'EL');
    expect(out).toMatchObject({ unit: 'ml', amount: 30 });
  });
});

describe('Namen', () => {
  it('vereinheitlicht Groß-/Kleinschreibung, Plural und Leerzeichen', () => {
    expect(nameKey(' Zwiebeln ')).toBe(nameKey('zwiebel'));
    expect(displayName('  zwiebel ')).toBe('Zwiebel');
  });
});

describe('Zusammenführen über mehrere Rezepte', () => {
  it('addiert gleiche Zutaten über Rezepte, Schreibweisen und Einheiten', () => {
    const a = recipe('a', [{ name: 'Zwiebel', amount: 2, unit: 'Stk' }, { name: 'Mehl', amount: 0.5, unit: 'kg' }]);
    const b = recipe('b', [{ name: 'zwiebeln', amount: 1, unit: 'Stück' }, { name: 'Mehl', amount: 250, unit: 'g' }]);
    const { items } = buildShoppingList([a, b], 2, 2);
    const onion = items.find((i) => nameKey(i.name) === nameKey('Zwiebel'));
    const flour = items.find((i) => nameKey(i.name) === nameKey('Mehl'));
    expect(items).toHaveLength(2);
    expect(onion).toMatchObject({ amount: 3, unit: 'Stk' });
    expect(flour).toMatchObject({ amount: 750, unit: 'g' });
  });

  it('führt Gewürze trotz mehrerer Rezepte zu einer Packung zusammen', () => {
    const a = recipe('a', [{ name: 'Rosmarin, frisch', amount: 4, unit: 'Stk' }, { name: 'Salz', amount: 1, unit: 'TL' }]);
    const b = recipe('b', [{ name: 'Rosmarin, frisch', amount: 6, unit: 'Stk' }, { name: 'Salz', amount: 2, unit: 'Prise' }]);
    const { items } = buildShoppingList([a, b], 2, 2);
    expect(items.filter((i) => i.name.startsWith('Rosmarin'))).toEqual([expect.objectContaining({ amount: 1, unit: 'Bund' })]);
    expect(items.filter((i) => i.name === 'Salz')).toEqual([expect.objectContaining({ amount: 1, unit: 'Pck' })]);
  });

  it('überspringt Zutaten ohne Namen', () => {
    const { items } = buildShoppingList([recipe('a', [{ name: '  ', amount: 1, unit: 'g' }])], 1, 1);
    expect(items).toHaveLength(0);
  });
});
