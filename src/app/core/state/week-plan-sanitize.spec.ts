import { describe, expect, it } from 'vitest';
import { sanitizeBlocked, sanitizeWeekPlan } from './week-plan-sanitize';

const recipe = (over: Record<string, unknown> = {}) => ({
  id: '1', title: 'Linsen', servings: 2, ingredients: [{ name: 'Linsen', amount: 100, unit: 'g' }], steps: ['kochen'],
  meal: 'dinner', portions: 2, ...over,
});
const plan = (over: Record<string, unknown> = {}) => ({
  id: 'w1', generatedAt: '2026-01-01T00:00:00.000Z', persons: 2, days: 3, meals: ['dinner'], notices: [], recipes: [recipe()], ...over,
});

describe('sanitizeWeekPlan (Review 3, Befund 6)', () => {
  it('lässt einen gültigen Plan unverändert', () => {
    expect(sanitizeWeekPlan(plan())).toEqual(plan());
  });

  it.each([
    ['null', null],
    ['Zahl', 5],
    ['Text', 'x'],
    ['Array', []],
    ['Rezepte kein Array', plan({ recipes: 'kaputt' })],
    ['persons NaN', plan({ persons: Number.NaN })],
    ['days 0', plan({ days: 0 })],
    ['id Zahl', plan({ id: 3 })],
    ['keine Rezepte', plan({ recipes: [] })],
  ])('verwirft den Plan bei %s', (_name, raw) => {
    expect(sanitizeWeekPlan(raw)).toBeNull();
  });

  it('verwirft nur kaputte Rezepte', () => {
    const r = sanitizeWeekPlan(plan({ recipes: [recipe(), recipe({ id: 2, title: 5 }), recipe({ meal: 'brunch' }), null, recipe({ id: '9', portions: -1 })] }));
    expect(r?.recipes.map((x) => x.id)).toEqual(['1']);
  });

  it('verwirft kaputte Zutaten und Schritte, nicht das Rezept', () => {
    const r = sanitizeWeekPlan(plan({ recipes: [recipe({ ingredients: [{ name: 'a', amount: 1, unit: 'g' }, { name: 3 }], steps: ['a', 4] })] }));
    expect(r?.recipes[0].ingredients).toHaveLength(1);
    expect(r?.recipes[0].steps).toEqual(['a']);
  });

  it('filtert unbekannte Mahlzeiten und verwirft den Plan ohne gültige', () => {
    expect(sanitizeWeekPlan(plan({ meals: ['dinner', 'x'] }))?.meals).toEqual(['dinner']);
    expect(sanitizeWeekPlan(plan({ meals: ['x'] }))).toBeNull();
  });

  it('lässt unsichere Bild- und Quell-Adressen weg', () => {
    const r = sanitizeWeekPlan(plan({ recipes: [recipe({ imageUrl: 'javascript:alert(1)', sourceUrl: 'https://a.de/x' })] }));
    expect(r?.recipes[0].imageUrl).toBeUndefined();
    expect(r?.recipes[0].sourceUrl).toBe('https://a.de/x');
  });
});

describe('sanitizeBlocked', () => {
  it('behält nur Texte ohne Duplikate', () => {
    expect(sanitizeBlocked(['a', 1, null, 'b', 'a'])).toEqual(['a', 'b']);
    expect(sanitizeBlocked('x')).toEqual([]);
    expect(sanitizeBlocked(null)).toEqual([]);
  });
});

describe('sanitizeWeekPlan Review 4 (D6, D19)', () => {
  it('verwirft Zutaten mit negativer Menge oder ungültigen Nährwerten', () => {
    const out = sanitizeWeekPlan(plan({
      recipes: [recipe({
        ingredients: [
          { name: 'a', amount: -1, unit: 'g' },
          { name: 'b', amount: 1, unit: 'g', facts: { kcal: 'x' } },
          { name: 'c', amount: 1, unit: 'g' },
        ],
      })],
    }));
    expect(out?.recipes[0].ingredients.map((i) => i.name)).toEqual(['c']);
  });

  it('übernimmt keine negativen Rezept-Nährwerte oder Zeiten', () => {
    const out = sanitizeWeekPlan(plan({
      recipes: [recipe({ facts: { kcal: -5, proteinG: 1, carbsG: 1, fatG: 1 }, readyInMinutes: -3 })],
    }));
    expect(out?.recipes[0].facts).toBeUndefined();
    expect(out?.recipes[0].readyInMinutes).toBeUndefined();
  });
});
