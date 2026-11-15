import { describe, expect, it } from 'vitest';
import {
  MAX_SHOPPING_ITEMS,
  MAX_SHOPPING_PRICE_EUR,
  MAX_SUGGESTED_DISHES,
  SHOPPING_INVALID_MESSAGE,
  sanitizeShoppingPlan,
} from './shopping-sanitize';

const item = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Haferflocken', amount: 500, unit: 'g', checked: false, estPrice: 1.2, ...over,
});
const plan = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  items: [item()], suggestedDishes: ['Porridge'], estTotal: 1.2, note: 'ok', ...over,
});

describe('sanitizeShoppingPlan', () => {
  it('uebernimmt eine gueltige Antwort in bekannter Form', () => {
    expect(sanitizeShoppingPlan(plan())).toEqual({
      items: [{ name: 'Haferflocken', amount: 500, unit: 'g', checked: false, estPrice: 1.2 }],
      suggestedDishes: ['Porridge'],
      estTotal: 1.2,
      note: 'ok',
    });
  });

  it('liefert leeres Ergebnis bei Nicht-Objekten', () => {
    for (const raw of [null, 'x', 5, [], undefined]) {
      expect(sanitizeShoppingPlan(raw).items).toEqual([]);
    }
  });

  it('verwirft Positionen ohne Namen, mit falschen Typen oder unbrauchbarer Menge', () => {
    const result = sanitizeShoppingPlan(plan({
      items: [item({ name: '' }), item({ name: 7 }), item({ amount: '500' }), item({ amount: -1 }),
        item({ amount: 0 }), item({ amount: NaN }), item({ amount: Infinity }), item({ amount: 1e9 }), null, 'Milch'],
    }));
    expect(result.items).toEqual([]);
  });

  it('kuerzt und saeubert Name und Einheit, setzt Stk bei leerer Einheit', () => {
    const [first] = sanitizeShoppingPlan(plan({ items: [item({ name: `  ${'A'.repeat(300)}\n`, unit: '  ' })] })).items;
    expect(first.name.length).toBeLessThanOrEqual(80);
    expect(first.name.startsWith('A')).toBe(true);
    expect(first.unit).toBe('Stk');
    const [long] = sanitizeShoppingPlan(plan({ items: [item({ unit: 'x'.repeat(100) })] })).items;
    expect(long.unit.length).toBeLessThanOrEqual(20);
  });

  it('laesst unplausible Preise weg, behaelt die Position', () => {
    const prices = [-1, NaN, Infinity, MAX_SHOPPING_PRICE_EUR + 1, '3', null];
    for (const estPrice of prices) {
      const [first] = sanitizeShoppingPlan(plan({ items: [item({ estPrice })] })).items;
      expect(first.estPrice).toBeUndefined();
    }
    const [zero] = sanitizeShoppingPlan(plan({ items: [item({ estPrice: 0 })] })).items;
    expect(zero.estPrice).toBe(0);
  });

  it('verwirft unbekannte Felder und erzwingt checked=false', () => {
    const [first] = sanitizeShoppingPlan(plan({ items: [item({ checked: true, manual: true, userPrice: 99, evil: 'x' })] })).items;
    expect(first).toEqual({ name: 'Haferflocken', amount: 500, unit: 'g', checked: false, estPrice: 1.2 });
  });

  it('begrenzt die Anzahl der Positionen und Gerichte', () => {
    const many = Array.from({ length: MAX_SHOPPING_ITEMS + 20 }, (_, i) => item({ name: `Ding ${i}` }));
    const dishes = Array.from({ length: MAX_SUGGESTED_DISHES + 10 }, (_, i) => `Gericht ${i}`);
    const result = sanitizeShoppingPlan(plan({ items: many, suggestedDishes: dishes }));
    expect(result.items).toHaveLength(MAX_SHOPPING_ITEMS);
    expect(result.suggestedDishes).toHaveLength(MAX_SUGGESTED_DISHES);
  });

  it('filtert ungueltige Gerichte und rechnet eine unplausible Summe aus den Positionen', () => {
    const result = sanitizeShoppingPlan(plan({
      suggestedDishes: ['Suppe', '', 5, null, 'x'.repeat(500)], estTotal: -50,
      items: [item({ estPrice: 2 }), item({ name: 'Milch', estPrice: 1.5 })],
    }));
    expect(result.suggestedDishes).toHaveLength(2);
    expect(result.suggestedDishes[1].length).toBeLessThanOrEqual(80);
    expect(result.estTotal).toBe(3.5);
  });

  it('macht aus Nicht-Text-Notiz kein Feld und kuerzt lange Notizen', () => {
    expect(sanitizeShoppingPlan(plan({ note: 12 })).note).toBeUndefined();
    expect(sanitizeShoppingPlan(plan({ note: null })).note).toBeUndefined();
    expect(sanitizeShoppingPlan(plan({ note: 'n'.repeat(1000) })).note!.length).toBeLessThanOrEqual(300);
  });

  it('hat eine verstaendliche Meldung fuer unbrauchbare Antworten', () => {
    expect(SHOPPING_INVALID_MESSAGE).toMatch(/Einkaufsliste/);
    expect(SHOPPING_INVALID_MESSAGE).not.toContain('—');
  });
});
