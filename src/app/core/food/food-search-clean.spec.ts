import { describe, expect, it } from 'vitest';
import { FoodItem } from '../models';
import {
  RankEntry, dedupe, normalizeBrand, normalizeQuantity, rank, removeBrandFromName, stripSize,
} from './food-search-clean';

function food(name: string, brand?: string, kcal = 100): FoodItem {
  return {
    id: name + brand, source: 'openfoodfacts', name, brand,
    facts: { kcal, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, saltG: 0, basis: 'per100g' },
  };
}
const entry = (item: FoodItem, locale = 0, categories?: string[]): RankEntry => ({ item, locale, categories });

describe('normalizeBrand', () => {
  it('de-slugt und title-cased', () => {
    expect(normalizeBrand('k-take-it-veggie')).toBe('K Take It Veggie');
  });
  it('dedupliziert case- und zeichenunabhängig', () => {
    expect(normalizeBrand('S-Budget, SBudget, s-budget')).toBe('S-Budget');
    expect(normalizeBrand('NÖM, nöm')).toBe('NÖM');
  });
  it('kollabiert Wiederholungen', () => {
    expect(normalizeBrand('Milka Milka')).toBe('Milka');
  });
  it('versteckt Marke, wenn gleich dem Namen', () => {
    expect(normalizeBrand('Nutella', 'Nutella')).toBeUndefined();
    expect(normalizeBrand('Ferrero, Nutella', 'Nutella')).toBe('Ferrero');
  });
  it('akzeptiert Array und leere Werte', () => {
    expect(normalizeBrand(['Alpro', ' '])).toBe('Alpro');
    expect(normalizeBrand(undefined)).toBeUndefined();
    expect(normalizeBrand('')).toBeUndefined();
  });
});

describe('normalizeQuantity / stripSize', () => {
  it('normalisiert Mengen', () => {
    expect(normalizeQuantity('400g')).toBe('400 g');
    expect(normalizeQuantity('1L')).toBe('1 l');
    expect(normalizeQuantity('6x250ml')).toBe('6 × 250 ml');
    expect(normalizeQuantity('')).toBeUndefined();
  });
  it('"Banane 120g"', () => {
    expect(stripSize('Banane 120g')).toEqual({ name: 'Banane', quantity: '120 g' });
  });
  it('"Mineralwasser 1L X1"', () => {
    expect(stripSize('Mineralwasser 1L X1')).toEqual({ name: 'Mineralwasser', quantity: '1 l' });
  });
  it('"Mehrweg Pet 1L" bleibt nicht leer', () => {
    const r = stripSize('Mehrweg Pet 1L');
    expect(r.quantity).toBe('1 l');
    expect(r.name.length).toBeGreaterThan(0);
  });
  it('entfernt Verpackungswörter bei Größe', () => {
    expect(stripSize('Cola Mehrweg Pet 1,5 L')).toEqual({ name: 'Cola', quantity: '1,5 l' });
  });
  it('lässt Namen ohne Größe unverändert', () => {
    expect(stripSize('Vitamin B12 Drink')).toEqual({ name: 'Vitamin B12 Drink' });
    expect(stripSize('Glas Nudeln')).toEqual({ name: 'Glas Nudeln' });
  });
});

describe('removeBrandFromName', () => {
  it('entfernt Marke im Namen', () => {
    expect(removeBrandFromName('Haferflocken Crownfield', 'Crownfield')).toBe('Haferflocken');
    expect(removeBrandFromName('Alpro Haferdrink', 'Alpro')).toBe('Haferdrink');
  });
  it('lässt Name, wenn nichts übrig bliebe', () => {
    expect(removeBrandFromName('Nutella', 'Nutella')).toBe('Nutella');
  });
  it('ohne Marke unverändert', () => {
    expect(removeBrandFromName('Banane', undefined)).toBe('Banane');
  });
});

describe('dedupe', () => {
  it('entfernt Duplikate nach Name+Marke+gerundeten kcal', () => {
    const list = [food('Nutella', 'Ferrero', 539.2), food('nutella', 'FERRERO', 538.6), food('Nutella', 'Ferrero', 520)];
    expect(dedupe(list)).toHaveLength(2);
  });
});

describe('rank', () => {
  it('Name-Treffer vor Marken-Treffer vor Rest, Locale nur als Tie-Break', () => {
    const skyr = entry(food('Skyr', 'Milsani'), 3);
    const milch = entry(food('Vollmilch', 'Weihenstephan'), 0);
    const brandOnly = entry(food('Käse', 'Milchwerke'), 3);
    const result = rank([skyr, brandOnly, milch], 'milch').map((e) => e.item.name);
    expect(result).toEqual(['Vollmilch', 'Käse', 'Skyr']);
  });
  it('Locale entscheidet bei Gleichstand', () => {
    const a = entry(food('Milch A'), 0);
    const b = entry(food('Milch B'), 3);
    expect(rank([a, b], 'milch').map((e) => e.item.name)).toEqual(['Milch B', 'Milch A']);
  });
  it('demotet verarbeitete Varianten bei generischer Ein-Wort-Suche', () => {
    const chips = entry(food('Bananenchips', 'X', 507), 3, ['en:snacks']);
    const dried = entry(food('Banane getrocknet', undefined, 340), 3);
    const fresh = entry(food('Banane', undefined, 89), 0, ['en:fruits']);
    const result = rank([chips, dried, fresh], 'banane').map((e) => e.item.name);
    expect(result[0]).toBe('Banane');
  });
  it('demotet nicht, wenn die Suche das Wort selbst enthält', () => {
    const chips = entry(food('Bananenchips'), 0, ['en:snacks']);
    const other = entry(food('Banane Chips Bio'), 0);
    expect(rank([other, chips], 'bananenchips')[0].item.name).toBe('Bananenchips');
  });
  it('Marken-Suche: reiner Marken-Treffer bleibt vor Nicht-Treffern', () => {
    const noMatch = entry(food('Wasser'), 3);
    const brand = entry(food('Haferflocken', 'Crownfield'), 0);
    expect(rank([noMatch, brand], 'crownfield')[0].item.name).toBe('Haferflocken');
  });
});
