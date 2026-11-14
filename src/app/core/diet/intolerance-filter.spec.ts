import { describe, expect, it } from 'vitest';
import { Intolerance } from '../models';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { filterByIntolerances, matchesIntolerance } from './intolerance-filter';

const hit = (text: string, i: Intolerance): boolean => matchesIntolerance(text, [i]);
const recipe = (id: string, title: string, ingredients: string[]): OnlineRecipe => ({
  id, title, servings: 2, steps: [], ingredients: ingredients.map((name) => ({ name, amount: 1, unit: 'g' })),
});

describe('matchesIntolerance Treffer', () => {
  it.each([
    ['dairy', 'whole milk'], ['dairy', 'Cheddar cheese'], ['dairy', 'Vollmilch'], ['dairy', 'Frischkäse'], ['dairy', 'Sahne'],
    ['dairy', 'Joghurt'], ['dairy', 'Quark'], ['dairy', 'butter'], ['dairy', 'Buttermilch'],
    ['egg', 'eggs'], ['egg', 'Eier'], ['egg', 'Ei'], ['egg', 'Eigelb'], ['egg', 'mayonnaise'],
    ['gluten', 'wheat flour'], ['gluten', 'breadcrumbs'], ['gluten', 'Nudeln'], ['gluten', 'Weizenmehl'], ['gluten', 'barley'], ['gluten', 'Roggenbrot'],
    ['wheat', 'whole wheat pasta'], ['wheat', 'Weizen'], ['wheat', 'bread'], ['wheat', 'Mehl'],
    ['peanut', 'peanuts'], ['peanut', 'Erdnüsse'], ['peanut', 'peanut butter'], ['peanut', 'Erdnussbutter'],
    ['tree nut', 'almonds'], ['tree nut', 'walnuts'], ['tree nut', 'hazelnut'], ['tree nut', 'cashew'], ['tree nut', 'Mandeln'], ['tree nut', 'Haselnüsse'],
    ['seafood', 'salmon fillet'], ['seafood', 'tuna'], ['seafood', 'shrimp'], ['seafood', 'Lachs'], ['seafood', 'Garnelen'],
    ['shellfish', 'shrimp'], ['shellfish', 'prawns'], ['shellfish', 'crab'], ['shellfish', 'Garnelen'],
    ['soy', 'soy sauce'], ['soy', 'tofu'], ['soy', 'edamame'], ['soy', 'Soja'], ['soy', 'Sojasauce'],
    ['sesame', 'sesame seeds'], ['sesame', 'tahini'], ['sesame', 'Sesam'],
  ] as const)('%s trifft "%s"', (intolerance, text) => {
    expect(hit(text, intolerance)).toBe(true);
  });
});

describe('matchesIntolerance Ausnahmen', () => {
  it('Kokosmilch und Pflanzenmilch sind keine Milch', () => {
    expect(hit('coconut milk', 'dairy')).toBe(false);
    expect(hit('Kokosmilch', 'dairy')).toBe(false);
    expect(hit('unsweetened almond milk', 'dairy')).toBe(false);
    expect(hit('Mandelmilch', 'dairy')).toBe(false);
  });

  it('Mandelmilch ist aber eine Baumnuss', () => {
    expect(hit('almond milk', 'tree nut')).toBe(true);
    expect(hit('Mandelmilch', 'tree nut')).toBe(true);
  });

  it('Erdnussbutter ist keine Butter, aber Erdnuss', () => {
    expect(hit('peanut butter', 'dairy')).toBe(false);
    expect(hit('Erdnussbutter', 'dairy')).toBe(false);
    expect(hit('peanut butter', 'peanut')).toBe(true);
  });

  it('Buchweizen ist kein Weizen und enthält kein Gluten', () => {
    expect(hit('buckwheat', 'wheat')).toBe(false);
    expect(hit('Buchweizen', 'wheat')).toBe(false);
    expect(hit('Buchweizenmehl', 'gluten')).toBe(false);
    expect(hit('buckwheat flour', 'gluten')).toBe(false);
  });

  it('Muskatnuss und nutmeg sind keine Baumnuss', () => {
    expect(hit('nutmeg', 'tree nut')).toBe(false);
    expect(hit('Muskatnuss', 'tree nut')).toBe(false);
  });

  it('glutenfreie Zutaten und Reismehl lösen nicht aus', () => {
    expect(hit('gluten-free pasta', 'gluten')).toBe(false);
    expect(hit('glutenfreie Nudeln', 'wheat')).toBe(false);
    expect(hit('rice flour', 'gluten')).toBe(false);
    expect(hit('Reismehl', 'wheat')).toBe(false);
  });

  it('Kokosnuss und Aubergine lösen nichts aus', () => {
    expect(hit('coconut', 'tree nut')).toBe(false);
    expect(hit('Kokosnuss', 'tree nut')).toBe(false);
    expect(hit('eggplant', 'egg')).toBe(false);
  });

  it('löst ohne Auswahl und bei leerem Text nichts aus', () => {
    expect(matchesIntolerance('milk', [])).toBe(false);
    expect(hit('', 'dairy')).toBe(false);
    expect(hit('Reis mit Gemüse', 'egg')).toBe(false);
  });
});

describe('filterByIntolerances', () => {
  const list = [
    recipe('1', 'Linsensuppe', ['red lentils', 'onion']),
    recipe('2', 'Pasta Carbonara', ['spaghetti', 'eggs', 'bacon']),
    recipe('3', 'Curry', ['coconut milk', 'rice']),
    recipe('4', 'Cheese toast', ['bread', 'cheddar cheese']),
  ];

  it('entfernt Treffer über Titel und Zutaten', () => {
    expect(filterByIntolerances(list, ['dairy']).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(filterByIntolerances(list, ['egg']).map((r) => r.id)).toEqual(['1', '3', '4']);
  });

  it('kombiniert mehrere Unverträglichkeiten', () => {
    expect(filterByIntolerances(list, ['dairy', 'wheat']).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('liefert ohne Auswahl dieselbe Liste', () => {
    expect(filterByIntolerances(list, [])).toBe(list);
  });
});
