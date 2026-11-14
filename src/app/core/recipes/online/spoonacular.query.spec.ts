import { describe, expect, it } from 'vitest';
import { MAX_FILTER_PARAM_CHARS } from '../../diet/diet-options';
import { EMPTY_FILTERS, buildSearchParams, parseQuotaLeft } from './spoonacular.query';

describe('buildSearchParams', () => {
  it('requests nutrition, instructions and ingredients with sane defaults', () => {
    const p = buildSearchParams({ ...EMPTY_FILTERS, query: ' pasta ' });
    expect(p).toMatchObject({
      number: '10', query: 'pasta', addRecipeNutrition: 'true', addRecipeInstructions: 'true',
      fillIngredients: 'true', instructionsRequired: 'true',
    });
    expect(p['offset']).toBeUndefined();
    expect(p['maxCalories']).toBeUndefined();
    expect(p['diet']).toBeUndefined();
  });

  it('adds filters and offset only when set', () => {
    const p = buildSearchParams({ query: '', maxCalories: 450, maxReadyTime: 30, diet: 'vegan' }, 20);
    expect(p).toMatchObject({ maxCalories: '450', maxReadyTime: '30', diet: 'vegan', offset: '20' });
    expect(p['query']).toBeUndefined();
  });

  it('adds minProtein, type and sort only with allowed values', () => {
    const p = buildSearchParams({ ...EMPTY_FILTERS, minProtein: 29.6, type: 'Main Course', sort: 'healthiness' });
    expect(p).toMatchObject({ minProtein: '30', type: 'main course', sort: 'healthiness', sortDirection: 'desc' });
    const bad = buildSearchParams({ ...EMPTY_FILTERS, minProtein: 0, type: 'evil', sort: 'price' });
    expect(bad['minProtein']).toBeUndefined();
    expect(bad['type']).toBeUndefined();
    expect(bad['sort']).toBeUndefined();
    expect(bad['sortDirection']).toBeUndefined();
  });

  it('sendet Unverträglichkeiten und Ausschlüsse kommagetrennt und nur mit gültigen Werten', () => {
    const p = buildSearchParams({
      ...EMPTY_FILTERS,
      diet: 'vegan',
      intolerances: ['gluten', 'banana', 'tree nut'],
      excludeIngredients: ['Mushrooms', 'bell pepper', 'x; DROP', ''],
    });
    expect(p).toMatchObject({ diet: 'vegan', intolerances: 'gluten,tree nut', excludeIngredients: 'mushrooms,bell pepper' });
  });

  it('lässt intolerances und excludeIngredients ohne Werte weg', () => {
    const p = buildSearchParams({ ...EMPTY_FILTERS, intolerances: [], excludeIngredients: ['', ' '] });
    expect(p['intolerances']).toBeUndefined();
    expect(p['excludeIngredients']).toBeUndefined();
  });

  it('sends no direction for random sort', () => {
    const p = buildSearchParams({ ...EMPTY_FILTERS, sort: 'random' });
    expect(p['sort']).toBe('random');
    expect(p['sortDirection']).toBeUndefined();
  });

  it('builds the cheapest request without extras', () => {
    expect(buildSearchParams(EMPTY_FILTERS, 0, 1, false)).toEqual({ number: '1' });
  });
});

describe('Listenparameter begrenzen', () => {
  it('sendet nur ganze Begriffe bis höchstens 200 Zeichen', () => {
    const terms = Array.from({ length: 30 }, (_, i) => `ingredient-${'x'.repeat(i + 1)}`);
    const params = buildSearchParams({ ...EMPTY_FILTERS, query: 'x', excludeIngredients: terms });
    const sent = params['excludeIngredients'].split(',');
    expect(params['excludeIngredients'].length).toBeLessThanOrEqual(MAX_FILTER_PARAM_CHARS);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((t) => terms.includes(t))).toBe(true);
    expect(sent).toEqual(terms.slice(0, sent.length));
  });

  it('lässt kürzere Listen unverändert', () => {
    const params = buildSearchParams({ ...EMPTY_FILTERS, intolerances: ['gluten', 'tree nut'], excludeIngredients: ['egg', 'mushrooms'] });
    expect(params['intolerances']).toBe('gluten,tree nut');
    expect(params['excludeIngredients']).toBe('egg,mushrooms');
  });
});

describe('parseQuotaLeft', () => {
  it('parses numeric headers and rejects the rest', () => {
    expect(parseQuotaLeft('42.0')).toBe(42);
    expect(parseQuotaLeft(null)).toBeNull();
    expect(parseQuotaLeft('')).toBeNull();
    expect(parseQuotaLeft('abc')).toBeNull();
    expect(parseQuotaLeft('-3')).toBeNull();
  });
});
