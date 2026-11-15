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
