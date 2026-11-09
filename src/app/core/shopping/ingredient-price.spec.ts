import { describe, expect, it } from 'vitest';
import { ShoppingItem } from '../models';
import { estimateItemPrice, fillMissingPrices, findPriceEntry } from './ingredient-price';

const item = (o: Partial<ShoppingItem>): ShoppingItem => ({ name: 'X', amount: 500, unit: 'g', checked: false, ...o });

describe('findPriceEntry', () => {
  it('findet spezifische vor allgemeinen Einträgen', () => {
    expect(findPriceEntry('Brauner Zucker')?.price).toBe(3.5);
    expect(findPriceEntry('Zucker')?.price).toBe(1.5);
    expect(findPriceEntry('Rote Linsen')?.keys).toContain('rote linsen');
  });

  it('liefert undefined bei Unbekanntem', () => {
    expect(findPriceEntry('Xyzfrucht')).toBeUndefined();
  });
});

describe('estimateItemPrice', () => {
  it('rechnet einen halben Zwiebel auf das Netz hoch', () => {
    expect(estimateItemPrice(item({ name: 'Zwiebel', amount: 0.5, unit: 'Stk' }))).toBe(2);
  });

  it('rechnet kg-Preise auf die Packungsgröße hoch', () => {
    expect(estimateItemPrice(item({ name: 'Rote Linsen', amount: 200, unit: 'g' }))).toBe(2.25);
  });

  it('rechnet lose Ware je 100 g', () => {
    expect(estimateItemPrice(item({ name: 'Schweinefleisch', amount: 900, unit: 'g' }))).toBe(8.1);
  });

  it('Gewürze kosten eine Packung', () => {
    expect(estimateItemPrice(item({ name: 'Rosmarin', amount: 1, unit: 'Bund' }))).toBe(1.5);
    expect(estimateItemPrice(item({ name: 'Salz', amount: 1, unit: 'Pck' }))).toBe(1);
  });

  it('Wasser ist kostenlos', () => {
    expect(estimateItemPrice(item({ name: 'Wasser', amount: 500, unit: 'ml' }))).toBe(0);
  });

  it('nutzt für Unbekanntes den Kategorie-Durchschnitt mit Mindestpreis', () => {
    const p = estimateItemPrice(item({ name: 'Xyzfrucht', amount: 1, unit: 'g', category: 'Obst & Gemüse' }));
    expect(p).toBeGreaterThanOrEqual(0.29);
    expect(estimateItemPrice(item({ name: 'Xyzfleisch', amount: 1000, unit: 'g', category: 'Fleisch & Fisch' }))).toBe(14);
  });

  it('liefert immer eine endliche Zahl', () => {
    expect(Number.isFinite(estimateItemPrice(item({ name: 'Zwiebel', amount: Number.NaN, unit: 'Stk' })))).toBe(true);
  });
});

describe('fillMissingPrices', () => {
  it('ergänzt nur fehlende Preise und lässt vorhandene unverändert', () => {
    const input = [item({ estPrice: 9.99 }), item({ name: 'Schweinefleisch' })];
    const out = fillMissingPrices(input);
    expect(out[0].estPrice).toBe(9.99);
    expect(out[1].estPrice).toBe(4.5);
    expect(input[1].estPrice).toBeUndefined();
  });
});
