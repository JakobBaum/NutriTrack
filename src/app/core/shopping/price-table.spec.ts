import { describe, expect, it } from 'vitest';
import { ShoppingItem } from '../models';
import { estimateByCategory, fillMissingPrices } from './price-table';

const item = (o: Partial<ShoppingItem>): ShoppingItem => ({ name: 'X', amount: 500, unit: 'g', checked: false, ...o });

describe('estimateByCategory', () => {
  it('rechnet über den Kilopreis der Kategorie, auf 10 Cent gerundet', () => {
    expect(estimateByCategory(item({ category: 'Fleisch & Fisch', amount: 500 }))).toBe(7);
    expect(estimateByCategory(item({ category: 'Obst & Gemüse', amount: 1, unit: 'kg' }))).toBe(3);
  });

  it('nutzt Sonstiges bei unbekannter oder fehlender Kategorie', () => {
    expect(estimateByCategory(item({ category: 'Foo' }))).toBe(2.5);
    expect(estimateByCategory(item({}))).toBe(2.5);
  });

  it('schätzt Stück über ein Standardgewicht', () => {
    expect(estimateByCategory(item({ category: 'Obst & Gemüse', amount: 2, unit: 'Stk' }))).toBe(0.9);
  });

  it('liefert null bei fehlender Menge oder nicht umrechenbarer Einheit', () => {
    expect(estimateByCategory(item({ amount: 0 }))).toBeNull();
    expect(estimateByCategory(item({ amount: Number.NaN }))).toBeNull();
    expect(estimateByCategory(item({ unit: 'Prise' }))).toBeNull();
  });

  it('hat einen Mindestpreis von 0,10 €', () => {
    expect(estimateByCategory(item({ amount: 1, unit: 'g' }))).toBe(0.1);
  });
});

describe('fillMissingPrices', () => {
  it('ergänzt nur fehlende Preise und lässt vorhandene unverändert', () => {
    const input = [item({ estPrice: 9.99 }), item({ category: 'Fleisch & Fisch' })];
    const out = fillMissingPrices(input);
    expect(out[0].estPrice).toBe(9.99);
    expect(out[1].estPrice).toBe(7);
    expect(input[1].estPrice).toBeUndefined();
  });
});
