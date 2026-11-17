import { describe, expect, it } from 'vitest';
import { ShoppingItem } from '../core/models';
import {
  DEFAULT_PERSONS,
  categoryOf,
  defaultPersons,
  defaultPersonsInRange,
  scaleRecipeIngredients,
  formatAmount,
  formatShareText,
  categoryLabel,
  groupByCategory,
  sortCategories,
  splitRows,
} from './shopping-list.util';

const item = (name: string, extra: Partial<ShoppingItem> & { category?: string } = {}): ShoppingItem =>
  ({ name, amount: 1, unit: 'Stk', checked: false, ...extra }) as ShoppingItem;
const rowsOf = (items: ShoppingItem[]) => items.map((it, index) => ({ item: it, id: String(index) }));

describe('categoryOf', () => {
  it('returns a trimmed category or null', () => {
    expect(categoryOf(item('Apfel', { category: ' Obst ' }))).toBe('Obst');
    expect(categoryOf(item('Apfel', { category: '  ' }))).toBeNull();
    expect(categoryOf(item('Apfel'))).toBeNull();
  });
});

describe('splitRows', () => {
  it('separates open and done rows keeping order and ids', () => {
    const result = splitRows(rowsOf([item('A'), item('B', { checked: true }), item('C')]));
    expect(result.open.map((r) => r.id)).toEqual(['0', '2']);
    expect(result.done.map((r) => r.id)).toEqual(['1']);
  });
});

describe('groupByCategory', () => {
  it('keeps original order in one ungrouped group when no item has a category', () => {
    const groups = groupByCategory(rowsOf([item('B'), item('A')]));
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBeNull();
    expect(groups[0].rows.map((r) => r.item.name)).toEqual(['B', 'A']);
  });

  it('groups by first appearance and puts uncategorized items last', () => {
    const groups = groupByCategory(
      rowsOf([
        item('Salz'),
        item('Apfel', { category: 'Obst' }),
        item('Milch', { category: 'Kühlregal' }),
        item('Birne', { category: 'Obst' }),
      ]),
    );
    expect(groups.map((g) => g.category)).toEqual(['Obst', 'Kühlregal', 'Sonstiges']);
    expect(groups[0].rows.map((r) => r.item.name)).toEqual(['Apfel', 'Birne']);
    expect(groups[2].rows.map((r) => r.id)).toEqual(['0']);
  });

  it('returns no groups for no rows', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe('formatAmount', () => {
  it('formats with decimal comma and returns null without amount', () => {
    expect(formatAmount(item('Mehl', { amount: 0.5, unit: 'kg' }))).toBe('500 g');
    expect(formatAmount(item('Mehl', { amount: 1.5, unit: 'kg' }))).toBe('1,5 kg');
    expect(formatAmount(item('Schweinefleisch', { amount: 900, unit: 'g' }), 'imperial')).toBe('2 lb');
    expect(formatAmount(item('Salz', { amount: 0, unit: 'g' }))).toBeNull();
  });
});

describe('formatShareText', () => {
  it('lists only open items, ungrouped when no categories exist', () => {
    const text = formatShareText([
      item('Reis', { amount: 500, unit: 'g' }),
      item('Brot', { checked: true }),
      item('Salz', { amount: 0, unit: 'g' }),
    ]);
    expect(text).toBe('Einkaufsliste\n\n- Reis (500 g)\n- Salz');
  });

  it('groups by category with headings', () => {
    const text = formatShareText([
      item('Apfel', { category: 'Obst', amount: 3 }),
      item('Salz', { amount: 0 }),
    ]);
    expect(text).toBe('Einkaufsliste\n\nObst:\n- Apfel (3 Stk)\n\nSonstiges:\n- Salz');
  });
});

describe('defaultPersons', () => {
  it('prefers a household size from the profile', () => {
    expect(defaultPersons({ householdSize: 4 }, 3)).toBe(4);
  });

  it('falls back to the last list, then the default', () => {
    expect(defaultPersons({ weightKg: 70 }, 3)).toBe(3);
    expect(defaultPersons(null, undefined)).toBe(DEFAULT_PERSONS);
    expect(defaultPersons({ persons: 1.5 }, 0)).toBe(DEFAULT_PERSONS);
  });
});

describe('sortCategories / categoryLabel', () => {
  it('ordnet bekannte Kategorien im Supermarkt-Fluss, Sonstiges zuletzt', () => {
    expect(sortCategories(['Sonstiges', 'Getränke', 'Obst & Gemüse', 'Fleisch & Fisch'])).toEqual([
      'Obst & Gemüse',
      'Fleisch & Fisch',
      'Getränke',
      'Sonstiges',
    ]);
  });

  it('hängt unbekannte Kategorien vor Sonstiges an', () => {
    expect(sortCategories(['Zeug', 'Obst & Gemüse', 'Sonstiges'])).toEqual(['Obst & Gemüse', 'Zeug', 'Sonstiges']);
  });

  it('ersetzt Schrägstriche durch Kommas', () => {
    expect(categoryLabel('Trockenware/Nudeln/Reis')).toBe('Trockenware, Nudeln, Reis');
    expect(categoryLabel('Obst & Gemüse')).toBe('Obst & Gemüse');
  });
});

describe('scaleRecipeIngredients', () => {
  it('skaliert auf die Personenzahl und markiert als eigene Position', () => {
    const items = scaleRecipeIngredients(
      { servings: 2, ingredients: [{ name: ' Mehl ', amount: 200, unit: 'g' }, { name: '', amount: 1, unit: 'g' }] },
      3,
    );
    expect(items).toEqual([{ name: 'Mehl', amount: 300, unit: 'g', checked: false, manual: true }]);
  });

  it('behandelt ungültige Portionen wie 1', () => {
    const items = scaleRecipeIngredients({ servings: 0, ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }] }, 2);
    expect(items[0].amount).toBe(200);
  });
});

describe('defaultPersonsInRange', () => {
  it('begrenzt die Vorbelegung auf den Stepper-Bereich', () => {
    expect(defaultPersonsInRange({ householdSize: 12 })).toBe(8);
    expect(defaultPersonsInRange(null, 3)).toBe(3);
  });
});
