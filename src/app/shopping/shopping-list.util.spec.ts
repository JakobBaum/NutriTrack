import { describe, expect, it } from 'vitest';
import { ShoppingItem } from '../core/models';
import {
  DEFAULT_PERSONS,
  adjustIndex,
  categoryOf,
  decodeIndexes,
  defaultPersons,
  encodeIndexes,
  formatAmount,
  formatShareText,
  categoryLabel,
  groupByCategory,
  sortCategories,
  splitRows,
} from './shopping-list.util';

const item = (name: string, extra: Partial<ShoppingItem> & { category?: string } = {}): ShoppingItem =>
  ({ name, amount: 1, unit: 'Stk', checked: false, ...extra }) as ShoppingItem;
const rowsOf = (items: ShoppingItem[]) => items.map((it, index) => ({ item: it, index }));

describe('categoryOf', () => {
  it('returns a trimmed category or null', () => {
    expect(categoryOf(item('Apfel', { category: ' Obst ' }))).toBe('Obst');
    expect(categoryOf(item('Apfel', { category: '  ' }))).toBeNull();
    expect(categoryOf(item('Apfel'))).toBeNull();
  });
});

describe('splitRows', () => {
  it('separates open and done rows keeping order and indexes', () => {
    const result = splitRows(rowsOf([item('A'), item('B', { checked: true }), item('C')]));
    expect(result.open.map((r) => r.index)).toEqual([0, 2]);
    expect(result.done.map((r) => r.index)).toEqual([1]);
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
    expect(groups[2].rows.map((r) => r.index)).toEqual([0]);
  });

  it('returns no groups for no rows', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe('formatAmount', () => {
  it('formats with decimal comma and returns null without amount', () => {
    expect(formatAmount(item('Mehl', { amount: 0.5, unit: 'kg' }))).toBe('0,5 kg');
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

describe('adjustIndex', () => {
  it('shifts by the number of removed indexes before it', () => {
    expect(adjustIndex(5, [1, 3, 7])).toBe(3);
    expect(adjustIndex(0, [2])).toBe(0);
  });
});

describe('encode/decodeIndexes', () => {
  it('round-trips and ignores invalid parts', () => {
    expect(decodeIndexes(encodeIndexes([2, 0, 5]))).toEqual([2, 0, 5]);
    expect(decodeIndexes('1,x,-2,3')).toEqual([1, 3]);
    expect(decodeIndexes(null)).toEqual([]);
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
