import { describe, expect, it } from 'vitest';
import { normalizeRecipeImport } from './recipe-import-normalize';

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
