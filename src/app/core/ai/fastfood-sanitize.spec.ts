import { describe, expect, it } from 'vitest';
import { sanitizeFastfoodSuggestions } from './fastfood-sanitize';

const valid = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  restaurant: 'McDonald’s',
  itemName: 'Chicken Burger',
  facts: { kcal: 440, proteinG: 25, carbsG: 34, fatG: 23, basis: 'perPortion' },
  rationale: 'Viel Eiweiß fürs Geld.',
  estPrice: 4.5,
  ...over,
});

describe('sanitizeFastfoodSuggestions', () => {
  it('uebernimmt gueltige Eintraege unveraendert in der Form', () => {
    const result = sanitizeFastfoodSuggestions([valid()]);
    expect(result).toEqual([
      {
        restaurant: 'McDonald’s',
        itemName: 'Chicken Burger',
        facts: { kcal: 440, proteinG: 25, carbsG: 34, fatG: 23, basis: 'perPortion' },
        rationale: 'Viel Eiweiß fürs Geld.',
        estPrice: 4.5,
      },
    ]);
  });

  it('liefert leere Liste bei Nicht-Arrays', () => {
    expect(sanitizeFastfoodSuggestions(null)).toEqual([]);
    expect(sanitizeFastfoodSuggestions({ itemName: 'x' })).toEqual([]);
    expect(sanitizeFastfoodSuggestions('Burger')).toEqual([]);
  });

  it('verwirft Eintraege ohne Namen oder mit falschen Typen', () => {
    const result = sanitizeFastfoodSuggestions([
      valid({ itemName: '' }),
      valid({ itemName: 42 }),
      valid({ restaurant: undefined }),
      null,
      'text',
      valid({ facts: 'viel' }),
      valid({ facts: { kcal: '440', proteinG: 25, carbsG: 34, fatG: 23 } }),
    ]);
    expect(result).toEqual([]);
  });

  it('kuerzt Namen und Begruendung und trimmt', () => {
    const [s] = sanitizeFastfoodSuggestions([valid({ itemName: `  ${'A'.repeat(300)}  `, rationale: 'B'.repeat(1000) })]);
    expect(s.itemName.length).toBeLessThanOrEqual(120);
    expect(s.itemName.startsWith('A')).toBe(true);
    expect(s.rationale.length).toBeLessThanOrEqual(300);
  });

  it('entfernt Steuerzeichen und Zeilenumbrueche aus Texten', () => {
    const [s] = sanitizeFastfoodSuggestions([valid({ itemName: 'Chicken\nBurger\u0007' })]);
    expect(s.itemName).toBe('Chicken Burger');
  });

  it('verwirft unplausible Zahlen (Grenzen, NaN, Infinity, negativ)', () => {
    const bad = (facts: Record<string, unknown>) => valid({ facts: { basis: 'perPortion', ...facts } });
    expect(sanitizeFastfoodSuggestions([
      bad({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }),
      bad({ kcal: 3500, proteinG: 100, carbsG: 300, fatG: 100 }),
      bad({ kcal: 440, proteinG: -1, carbsG: 34, fatG: 23 }),
      bad({ kcal: Number.NaN, proteinG: 25, carbsG: 34, fatG: 23 }),
      bad({ kcal: 440, proteinG: Number.POSITIVE_INFINITY, carbsG: 34, fatG: 23 }),
      bad({ kcal: 440, proteinG: 25, carbsG: 301, fatG: 23 }),
    ])).toEqual([]);
  });

  it('verwirft Eintraege, deren kcal nicht zu Eiweiss, Kohlenhydraten und Fett passen (4/4/9)', () => {
    expect(sanitizeFastfoodSuggestions([valid({ facts: { kcal: 100, proteinG: 40, carbsG: 60, fatG: 40, basis: 'perPortion' } })])).toEqual([]);
    expect(sanitizeFastfoodSuggestions([valid({ facts: { kcal: 1500, proteinG: 10, carbsG: 10, fatG: 5, basis: 'perPortion' } })])).toEqual([]);
  });

  it('akzeptiert kleine Abweichungen durch Ballaststoffe und Rundung', () => {
    expect(sanitizeFastfoodSuggestions([valid({ facts: { kcal: 400, proteinG: 25, carbsG: 34, fatG: 23, basis: 'perPortion' } })])).toHaveLength(1);
  });

  it('macht den Preis optional und verwirft unsinnige Preise nur beim Preis', () => {
    const result = sanitizeFastfoodSuggestions([valid({ estPrice: undefined }), valid({ itemName: 'B', estPrice: -3 }), valid({ itemName: 'C', estPrice: 999 }), valid({ itemName: 'D', estPrice: 'teuer' })]);
    expect(result.map((s) => s.estPrice)).toEqual([undefined, undefined, undefined, undefined]);
    expect(result).toHaveLength(4);
  });

  it('begrenzt eine Antwort auf hoechstens 5 Eintraege', () => {
    const many = Array.from({ length: 9 }, (_, i) => valid({ itemName: `Burger ${i}` }));
    expect(sanitizeFastfoodSuggestions(many)).toHaveLength(5);
  });

  it('behaelt gueltige Eintraege neben ungueltigen', () => {
    const result = sanitizeFastfoodSuggestions([valid({ itemName: '' }), valid({ itemName: 'Gut' })]);
    expect(result.map((s) => s.itemName)).toEqual(['Gut']);
  });

  it('uebernimmt nur bekannte Felder (keine fremden Eigenschaften)', () => {
    const [s] = sanitizeFastfoodSuggestions([valid({ evil: '<script>', facts: { kcal: 440, proteinG: 25, carbsG: 34, fatG: 23, basis: 'perPortion', hack: 1 } })]);
    expect(Object.keys(s).sort()).toEqual(['estPrice', 'facts', 'itemName', 'rationale', 'restaurant']);
    expect(Object.keys(s.facts).sort()).toEqual(['basis', 'carbsG', 'fatG', 'kcal', 'proteinG']);
  });
});
