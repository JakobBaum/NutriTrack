import { describe, expect, it } from 'vitest';
import { sanitizeRecipes } from './recipe-sanitize';

const ref = { source: 'spoonacular', externalId: '4242', savedAt: '2026-11-01T10:00:00.000Z' };
const own = { id: 'a', title: 'Eigen', servings: 2, ingredients: [{ name: 'Reis', amount: 1, unit: 'g' }], steps: [] };
const refRecord = { id: 'b', title: 'Verweis', servings: 1, ingredients: [], steps: [], onlineRef: ref };

describe('sanitizeRecipes', () => {
  it('behält gültige eigene Rezepte und gültige Verweise', () => {
    const r = sanitizeRecipes([own, refRecord]);
    expect(r.items).toEqual([own, refRecord]);
    expect(r.rejected).toEqual([]);
    expect(r.repaired).toBe(0);
  });

  it('entfernt ein ungültiges onlineRef, wenn das Rezept Zutaten hat', () => {
    const r = sanitizeRecipes([{ ...own, onlineRef: null }]);
    expect(r.items).toEqual([own]);
    expect(r.repaired).toBe(1);
    expect(r.rejected).toEqual([]);
  });

  it('verwirft einen Verweis ohne Zutaten und ohne gültige Referenz', () => {
    const broken = { ...refRecord, onlineRef: { ...ref, externalId: 'abc' } };
    const r = sanitizeRecipes([broken, own]);
    expect(r.items).toEqual([own]);
    expect(r.rejected).toEqual([broken]);
  });

  it('verwirft Nicht-Listen als Ganzes und weiterhin Rezepte ohne Pflichtfelder', () => {
    expect(sanitizeRecipes('x').rejected).toEqual(['x']);
    expect(sanitizeRecipes([{ id: 1 }]).rejected).toEqual([{ id: 1 }]);
  });
});

describe('sanitizeRecipes — reparieren statt verwerfen (Prüfrunde 2)', () => {
  it('entfernt ungültige Nährwerte einer Zutat (facts: null) und behält das Rezept', () => {
    const r = sanitizeRecipes([{ ...own, ingredients: [{ name: 'Reis', amount: 1, unit: 'g', facts: null }] }]);
    expect(r.rejected).toEqual([]);
    expect(r.items).toEqual([own]);
    expect(r.repaired).toBe(1);
  });

  it('setzt eine fehlende oder ungültige Menge auf 0', () => {
    const bad = [{ name: 'A', amount: null, unit: 'g' }, { name: 'B', amount: Number.NaN, unit: 'g' }, { name: 'C', amount: -2, unit: 'g' }];
    const r = sanitizeRecipes([{ ...own, ingredients: bad }]);
    expect(r.rejected).toEqual([]);
    expect(r.items[0].ingredients.map((i) => i.amount)).toEqual([0, 0, 0]);
    expect(r.repaired).toBe(1);
  });

  it('repariert servings null (aus NaN nach JSON) zu 1, statt das Rezept zu verwerfen', () => {
    const r = sanitizeRecipes([{ ...own, servings: null }]);
    expect(r.rejected).toHaveLength(0);
    expect(r.repaired).toBe(1);
    expect(r.items[0].servings).toBe(1);
  });

  it('hebt servings 0 auf 1', () => {
    const r = sanitizeRecipes([{ ...own, servings: 0 }]);
    expect(r.items[0].servings).toBe(1);
    expect(r.repaired).toBe(1);
  });

  it('verwirft weiterhin strukturell unbrauchbare Rezepte (Zutat ohne Namen, Schritte kein Text)', () => {
    const noName = { ...own, ingredients: [{ amount: 1, unit: 'g' }] };
    const badSteps = { ...own, steps: [1, 2] };
    const r = sanitizeRecipes([noName, badSteps, own]);
    expect(r.rejected).toEqual([noName, badSteps]);
    expect(r.items).toEqual([own]);
  });

  it('verändert das Eingabeobjekt nicht', () => {
    const input = { ...own, servings: 0, ingredients: [{ name: 'Reis', amount: null, unit: 'g' }] };
    const copy = JSON.parse(JSON.stringify(input));
    sanitizeRecipes([input]);
    expect(input).toEqual(copy);
  });
});
