import { describe, expect, it } from 'vitest';
import { recipeCookIngredients } from './recipe-cook-ingredients';

describe('recipeCookIngredients', () => {
  it('uebernimmt Name, Menge, Einheit und ca.-Kennzeichen', () => {
    const result = recipeCookIngredients([
      { name: ' Linsen ', amount: 200, unit: 'g' },
      { name: 'Tasse Reis', amount: 1, unit: 'cup', approx: true },
    ]);
    expect(result).toEqual([
      { name: 'Linsen', amount: 200, unit: 'g' },
      { name: 'Tasse Reis', amount: 1, unit: 'cup', approx: true },
    ]);
  });

  it('laesst Zutaten ohne Namen weg', () => {
    expect(recipeCookIngredients([{ name: '  ', amount: 1, unit: 'g' }])).toEqual([]);
  });
});
