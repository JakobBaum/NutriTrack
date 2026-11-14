import { describe, expect, it } from 'vitest';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { filterByDislikes, matchesDislike } from './dislike-filter';

const recipe = (id: string, title: string, ingredients: string[] = []): OnlineRecipe => ({
  id, title, servings: 2, steps: [], ingredients: ingredients.map((name) => ({ name, amount: 1, unit: 'g' })),
});

describe('matchesDislike', () => {
  it('trifft ganze Wörter ohne Groß-/Kleinschreibung', () => {
    expect(matchesDislike('Pilze Pfanne', ['pilze'])).toBe(true);
    expect(matchesDislike('Chicken with MUSHROOMS', ['mushrooms'])).toBe(true);
  });

  it('trifft "ei" nicht in "Reis", "Eis" oder "Weizen"', () => {
    expect(matchesDislike('Reis mit Gemüse', ['ei'])).toBe(false);
    expect(matchesDislike('Eis am Stiel', ['ei'])).toBe(false);
    expect(matchesDislike('Weizenmehl', ['ei'])).toBe(false);
    expect(matchesDislike('Ei im Glas', ['ei'])).toBe(true);
  });

  it('trifft einfache Mehrzahl- und Beugungsformen ab drei Zeichen', () => {
    expect(matchesDislike('Zwiebeln anbraten', ['zwiebel'])).toBe(true);
    expect(matchesDislike('boiled eggs', ['egg'])).toBe(true);
    expect(matchesDislike('Pilze', ['pilz'])).toBe(true);
  });

  it('trennt an Bindestrich und Satzzeichen', () => {
    expect(matchesDislike('Tomaten-Suppe (scharf)', ['suppe'])).toBe(true);
    expect(matchesDislike('Pilz, Lauch', ['lauch'])).toBe(true);
  });

  it('trifft mehrteilige Begriffe nur als zusammenhängende Wortfolge', () => {
    expect(matchesDislike('Red bell pepper salad', ['bell pepper'])).toBe(true);
    expect(matchesDislike('pepper with bell', ['bell pepper'])).toBe(false);
  });

  it('beachtet Umlaute als Buchstaben', () => {
    expect(matchesDislike('Käse überbacken', ['käse'])).toBe(true);
    expect(matchesDislike('Käsekuchen', ['käse'])).toBe(false);
  });

  it('ignoriert leere Begriffe und leeren Text', () => {
    expect(matchesDislike('Pilze', ['', '   '])).toBe(false);
    expect(matchesDislike('', ['pilze'])).toBe(false);
    expect(matchesDislike('Pilze', [])).toBe(false);
  });
});

describe('filterByDislikes', () => {
  const list = [
    recipe('1', 'Nudeln mit Pesto', ['Nudeln', 'Basilikum']),
    recipe('2', 'Gemüsepfanne', ['Zucchini', 'Pilze']),
    recipe('3', 'Reis-Bowl', ['Reis', 'Avocado']),
    recipe('4', 'Egg salad', ['eggs', 'mayonnaise']),
  ];

  it('entfernt Treffer mit Begriff im Zutatennamen', () => {
    expect(filterByDislikes(list, ['Pilze']).map((r) => r.id)).toEqual(['1', '3', '4']);
  });

  it('nutzt auch englische Begriffe und entfernt Treffer mit Begriff im Titel', () => {
    expect(filterByDislikes(list, ['egg']).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(filterByDislikes(list, ['Pesto']).map((r) => r.id)).toEqual(['2', '3', '4']);
  });

  it('lässt das Reis-Rezept bei "Ei" stehen', () => {
    expect(filterByDislikes(list, ['Ei']).map((r) => r.id)).toEqual(['1', '2', '3', '4']);
  });

  it('gibt ohne Begriffe die Liste unverändert zurück', () => {
    expect(filterByDislikes(list, [])).toBe(list);
    expect(filterByDislikes(list, ['', ' '])).toEqual(list);
  });
});

describe('matchesDislike Beugungen', () => {
  it('trifft englische Mehrzahl auf -es und -ies', () => {
    expect(matchesDislike('Stuffed tomatoes', ['tomato'])).toBe(true);
    expect(matchesDislike('Roasted potatoes', ['potato'])).toBe(true);
    expect(matchesDislike('Grilled peaches', ['peach'])).toBe(true);
    expect(matchesDislike('Mixed berries', ['berry'])).toBe(true);
  });

  it('trifft "Ei" in Eier und Eiern, aber nicht in Reis, Eis oder einrühren', () => {
    expect(matchesDislike('Eier verquirlen', ['Ei'])).toBe(true);
    expect(matchesDislike('mit Eiern backen', ['ei'])).toBe(true);
    expect(matchesDislike('Reis', ['ei'])).toBe(false);
    expect(matchesDislike('Eis', ['ei'])).toBe(false);
    expect(matchesDislike('Teig einrühren', ['ei'])).toBe(false);
    expect(matchesDislike('Eisbergsalat', ['ei'])).toBe(false);
  });

  it('erzeugt keine neuen Fehltreffer durch die Endungen', () => {
    expect(matchesDislike('Berry smoothie', ['bar'])).toBe(false);
    expect(matchesDislike('Peach', ['pea'])).toBe(false);
    expect(matchesDislike('Tomatensuppe', ['tomate'])).toBe(false);
  });
});
