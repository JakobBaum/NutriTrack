import { describe, expect, it } from 'vitest';
import { normalizeRecipeImport, parseIngredientFacts } from './recipe-import-normalize';

describe('normalizeRecipeImport', () => {
  it('leitet die Nährwert-Basis aus der Einheit ab (g → per100g, Stk → perPortion)', () => {
    // Arrange
    const raw = {
      title: 'Omelett',
      servings: 1,
      ingredients: [
        { name: 'Milch', amount: 50, unit: 'ml', facts: { kcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.6 } },
        { name: 'Ei', amount: 2, unit: 'Stk', facts: { kcal: 78, proteinG: 6.5, carbsG: 0.4, fatG: 5.5 } },
      ],
      steps: ['Verquirlen', ' ', 'Braten'],
    };

    // Act
    const result = normalizeRecipeImport(raw, 'https://example.org/r');

    // Assert
    expect(result.ingredients[0].facts?.basis).toBe('per100g');
    expect(result.ingredients[1].facts?.basis).toBe('perPortion');
    expect(result.ingredients[1].facts?.portionG).toBe(50);
    expect(result.steps).toEqual(['Verquirlen', 'Braten']);
    expect(result.sourceUrl).toBe('https://example.org/r');
  });

  it('übersteht kaputte KI-Antworten (kein Objekt, falsche Typen, negative Werte)', () => {
    // Act
    const fromString = normalizeRecipeImport('kein json');
    const fromJunk = normalizeRecipeImport({
      title: '',
      servings: -3,
      ingredients: [null, { name: '' }, { name: 'Salz', amount: -5, unit: '', facts: { kcal: 0 } }],
      steps: 'nicht-array',
    });

    // Assert
    expect(fromString.title).toBe('Importiertes Rezept');
    expect(fromString.ingredients).toEqual([]);
    expect(fromJunk.servings).toBe(2);
    expect(fromJunk.ingredients).toEqual([{ name: 'Salz', amount: 0, unit: 'g', facts: undefined }]);
    expect(fromJunk.steps).toEqual([]);
  });
});

describe('parseIngredientFacts / normalizeRecipeImport — Randfälle', () => {
  it('verwirft fehlende, primitive und reine Null-Nährwerte', () => {
    expect(parseIngredientFacts(undefined, 'g')).toBeUndefined();
    expect(parseIngredientFacts('100 kcal', 'g')).toBeUndefined();
    expect(parseIngredientFacts({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 3 }, 'g')).toBeUndefined();
  });

  it('akzeptiert numerische Strings und klemmt negative/NaN-Werte auf 0', () => {
    const f = parseIngredientFacts({ kcal: '120', proteinG: -3, carbsG: 'x', fatG: 2 }, 'g')!;
    expect(f).toMatchObject({ kcal: 120, proteinG: 0, carbsG: 0, fatG: 2, fiberG: 0, sugarG: 0 });
  });

  it('übernimmt eine gültige Basis der KI und ignoriert ungültige', () => {
    expect(parseIngredientFacts({ kcal: 50, basis: 'perPortion', portionG: 30 }, 'g')).toMatchObject({ basis: 'perPortion', portionG: 30 });
    expect(parseIngredientFacts({ kcal: 50, basis: 'perKilo' }, 'ML')!.basis).toBe('per100g');
    expect(parseIngredientFacts({ kcal: 50, basis: 'per100g', portionG: 30 }, 'Stk')!.portionG).toBeUndefined();
  });

  it('setzt 50 g als Portionsgewicht bei fehlendem/0 portionG', () => {
    expect(parseIngredientFacts({ kcal: 50, portionG: 0 }, 'EL')!.portionG).toBe(50);
  });

  // BUG: GRAM_UNITS kennt kg/l nicht → ohne KI-Basis wird „kg" als perPortion (50 g) gedeutet.
  // recipe-import-normalize.ts:5 — Eingabe: unit 'kg', facts ohne basis; erwartet: per100g, tatsächlich: perPortion.
  it('leitet bei kg/l ebenfalls per100g ab', () => {
    expect(parseIngredientFacts({ kcal: 364 }, 'kg')!.basis).toBe('per100g');
  });

  it('rundet servings, trimmt Titel/Namen und nimmt g als Standard-Einheit', () => {
    const r = normalizeRecipeImport({
      title: '  Suppe ',
      servings: '3.6',
      ingredients: [{ name: ' Karotte ', amount: '2', unit: '  ' }, 'kaputt'],
      steps: [1, '  '],
    });
    expect(r.title).toBe('Suppe');
    expect(r.servings).toBe(4);
    expect(r.ingredients).toEqual([{ name: 'Karotte', amount: 2, unit: 'g', facts: undefined }]);
    expect(r.steps).toEqual(['1']);
  });

  it('übersteht null und Arrays als Wurzel', () => {
    expect(normalizeRecipeImport(null).servings).toBe(2);
    expect(normalizeRecipeImport([]).ingredients).toEqual([]);
  });
});

// BUG: Mengen mit Dezimalkomma aus der KI („2,5") werden zu 0 (Number('2,5') = NaN).
// recipe-import-normalize.ts:12 (num) — erwartet: 2.5, tatsächlich: 0.
it('parst Mengen mit Dezimalkomma', () => {
  const r = normalizeRecipeImport({ ingredients: [{ name: 'Mehl', amount: '2,5', unit: 'kg' }] });
  expect(r.ingredients[0].amount).toBe(2.5);
});
