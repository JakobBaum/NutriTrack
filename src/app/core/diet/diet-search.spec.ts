import { describe, expect, it } from 'vitest';
import { EMPTY_DIET_PREFS, DietPrefs } from './diet-prefs';
import { dietSearchPrefs, describeDietPrefs } from './diet-search';

const PREFS: DietPrefs = {
  diet: 'vegetarian', intolerances: ['gluten', 'tree nut'], dislikes: ['Pilze', 'Lauch', 'Ei'], dislikesEn: ['mushrooms', '', 'egg'],
};

describe('dietSearchPrefs', () => {
  it('liefert Ernährungsform, Unverträglichkeiten und englische Ausschlüsse ohne Leereinträge', () => {
    expect(dietSearchPrefs(PREFS)).toEqual({
      diet: 'vegetarian',
      intolerances: ['gluten', 'tree nut'],
      excludeIngredients: ['mushrooms', 'egg'],
      dislikeTerms: ['Pilze', 'Lauch', 'Ei', 'mushrooms', 'egg'],
    });
  });

  it('ist ohne Angaben leer', () => {
    expect(dietSearchPrefs(EMPTY_DIET_PREFS)).toEqual({ diet: '', intolerances: [], excludeIngredients: [], dislikeTerms: [] });
  });
});

describe('describeDietPrefs', () => {
  it('fasst die Auswahl in einer Zeile zusammen', () => {
    expect(describeDietPrefs(PREFS)).toBe('Vegetarisch · Gluten, Baumnüsse · 3 Abneigungen');
  });

  it('nutzt die Einzahl und lässt Leeres weg', () => {
    expect(describeDietPrefs({ ...EMPTY_DIET_PREFS, dislikes: ['Pilze'], dislikesEn: [''] })).toBe('1 Abneigung');
    expect(describeDietPrefs({ ...EMPTY_DIET_PREFS, diet: 'vegan' })).toBe('Vegan');
  });

  it('liefert null ohne Angaben', () => {
    expect(describeDietPrefs(EMPTY_DIET_PREFS)).toBeNull();
  });
});
