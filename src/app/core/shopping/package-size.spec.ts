import { describe, expect, it } from 'vitest';
import { ShoppingItem } from '../models';
import { ceilToPack, roundItemsToPackages, roundToPackage } from './package-size';

const item = (name: string, amount: number, unit: string, estPrice?: number): ShoppingItem => ({
  name,
  amount,
  unit,
  checked: false,
  estPrice,
});

describe('ceilToPack', () => {
  it('nimmt die kleinste passende Packung, darüber Vielfache der kleinsten', () => {
    expect(ceilToPack(300, [500, 700])).toBe(500);
    expect(ceilToPack(600, [500, 700])).toBe(700);
    expect(ceilToPack(1250, [500, 700])).toBe(1500);
    expect(ceilToPack(2000, [500, 700])).toBe(2000);
  });
});

describe('roundToPackage', () => {
  it('rundet Nudeln auf 500-g-Packungen und führt den Preis mit', () => {
    const r = roundToPackage(item('Nudeln', 1250, 'g', 5));
    expect(r.amount).toBe(1500);
    expect(r.estPrice).toBe(6);
  });

  it('rundet passierte Tomaten auf 500/700 g', () => {
    expect(roundToPackage(item('Passierte Tomaten', 650, 'g')).amount).toBe(700);
    expect(roundToPackage(item('Passierte Tomaten', 2000, 'g')).amount).toBe(2000);
  });

  it('rechnet Zwiebeln in Gramm in ganze Stück um', () => {
    const r = roundToPackage(item('Zwiebel', 250, 'g'));
    expect(r).toMatchObject({ amount: 4, unit: 'Stk' });
  });

  it('rundet Zählware auf ganze Stück', () => {
    expect(roundToPackage(item('Zwiebel', 2.5, 'Stk')).amount).toBe(3);
    expect(roundToPackage(item('Knoblauch', 1.2, 'Zehe')).amount).toBe(2);
  });

  it('rundet Milch auf ganze Liter, Kokosmilch bleibt', () => {
    expect(roundToPackage(item('Milch', 300, 'ml'))).toMatchObject({ amount: 1, unit: 'l' });
    expect(roundToPackage(item('Kokosmilch', 300, 'ml')).amount).toBe(300);
  });

  it('lässt Positionen ohne Menge und unbekannte Einheiten unverändert', () => {
    const none = item('Salz', 0, 'g');
    expect(roundToPackage(none)).toBe(none);
    const spoon = item('Olivenöl', 15, 'EL');
    expect(roundToPackage(spoon)).toBe(spoon);
  });

  it('verändert die Eingabe nicht', () => {
    const original = item('Nudeln', 100, 'g', 1);
    roundItemsToPackages([original]);
    expect(original.amount).toBe(100);
  });
});
