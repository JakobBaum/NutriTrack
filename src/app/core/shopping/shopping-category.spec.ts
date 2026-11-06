import { describe, expect, it } from 'vitest';
import {
  SHOPPING_CATEGORIES,
  categorizeName,
  normalizeCategory,
  withCategories,
  withCategory,
} from './shopping-category';

const item = (name: string, category?: string) => ({ name, amount: 1, unit: 'Stk', checked: false, category });

describe('categorizeName', () => {
  it.each([
    ['Tomaten', 'Obst & Gemüse'],
    ['Zwiebel', 'Obst & Gemüse'],
    ['banana', 'Obst & Gemüse'],
    ['Vollmilch', 'Kühlregal/Milchprodukte'],
    ['Eier', 'Kühlregal/Milchprodukte'],
    ['Parmesan', 'Kühlregal/Milchprodukte'],
    ['Hühnerbrustfilet', 'Fleisch & Fisch'],
    ['Räucherlachs', 'Fleisch & Fisch'],
    ['Toastbrot', 'Brot & Backwaren'],
    ['Nudeln', 'Trockenware/Nudeln/Reis'],
    ['Basmatireis', 'Trockenware/Nudeln/Reis'],
    ['Eiernudeln', 'Trockenware/Nudeln/Reis'],
    ['Weizenmehl', 'Trockenware/Nudeln/Reis'],
    ['Passierte Tomaten', 'Konserven & Saucen'],
    ['Tomatenmark', 'Konserven & Saucen'],
    ['Kokosmilch', 'Konserven & Saucen'],
    ['Olivenöl', 'Gewürze & Öle'],
    ['Paprikapulver', 'Gewürze & Öle'],
    ['Salz', 'Gewürze & Öle'],
    ['Tiefkühlerbsen', 'Tiefkühl'],
    ['Eis', 'Tiefkühl'],
    ['Apfelsaft', 'Getränke'],
    ['Mineralwasser', 'Getränke'],
  ])('ordnet %s zu %s', (name, expected) => {
    expect(categorizeName(name)).toBe(expected);
  });

  it('fällt bei Unbekanntem und Leerem auf Sonstiges zurück', () => {
    expect(categorizeName('Spülmittel')).toBe('Sonstiges');
    expect(categorizeName('   ')).toBe('Sonstiges');
  });

  it('liefert nur gültige Kategorien', () => {
    expect(SHOPPING_CATEGORIES).toContain(categorizeName('Lauch'));
  });
});

describe('normalizeCategory', () => {
  it('akzeptiert gültige Kategorien ohne Groß-/Kleinschreibung', () => {
    expect(normalizeCategory(' tiefkühl ')).toBe('Tiefkühl');
  });

  it('verwirft ungültige Werte', () => {
    expect(normalizeCategory('Haushalt')).toBeNull();
    expect(normalizeCategory(42)).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
  });
});

describe('withCategory', () => {
  it('behält eine gültige Kategorie und ersetzt eine ungültige', () => {
    expect(withCategory(item('Milch', 'Getränke')).category).toBe('Getränke');
    expect(withCategory(item('Milch', 'Quatsch')).category).toBe('Kühlregal/Milchprodukte');
  });

  it('ergänzt fehlende Kategorie ohne das Original zu verändern', () => {
    const original = item('Lauch');
    const result = withCategories([original]);
    expect(result[0].category).toBe('Obst & Gemüse');
    expect(original.category).toBeUndefined();
  });
});
