import { describe, expect, it } from 'vitest';
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

  it('sends no direction for random sort', () => {
    const p = buildSearchParams({ ...EMPTY_FILTERS, sort: 'random' });
    expect(p['sort']).toBe('random');
    expect(p['sortDirection']).toBeUndefined();
  });

  it('builds the cheapest request without extras', () => {
    expect(buildSearchParams(EMPTY_FILTERS, 0, 1, false)).toEqual({ number: '1' });
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
