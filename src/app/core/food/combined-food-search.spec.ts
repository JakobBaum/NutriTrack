import { describe, expect, it } from 'vitest';
import { FoodItem } from '../models';
import { CustomFood } from '../state/custom-food.store';
import { withCustomFoods } from './combined-food-search';

const FACTS = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'per100g' as const };
const off = (name: string): FoodItem => ({ id: name, source: 'openfoodfacts', name, facts: FACTS });
const own: CustomFood = { id: 'x', name: 'Joghurt Natur', facts: { ...FACTS, basis: 'perPortion' }, createdAt: '2026-01-01T00:00:00.000Z' };

describe('withCustomFoods', () => {
  it('stellt eigene Treffer vor die Online-Treffer', async () => {
    const search = withCustomFoods({ searchByText: async () => [off('Joghurt Bio')] }, () => [own]);
    const names = (await search.searchByText('joghurt')).map((i) => i.name);
    expect(names).toEqual(['Joghurt Natur', 'Joghurt Bio']);
  });

  it('zeigt eigene Treffer weiter, wenn die Online-Quelle ausfällt', async () => {
    const search = withCustomFoods({ searchByText: async () => { throw new Error('offline'); } }, () => [own]);
    expect((await search.searchByText('joghurt')).map((i) => i.id)).toEqual(['custom:x']);
  });

  it('reicht den Fehler ohne eigene Treffer weiter', async () => {
    const search = withCustomFoods({ searchByText: async () => { throw new Error('offline'); } }, () => [own]);
    await expect(search.searchByText('reis')).rejects.toThrow('offline');
  });

  it('liest die eigenen Lebensmittel bei jeder Suche neu', async () => {
    let list: CustomFood[] = [];
    const search = withCustomFoods({ searchByText: async () => [] }, () => list);
    expect(await search.searchByText('joghurt')).toEqual([]);
    list = [own];
    expect(await search.searchByText('joghurt')).toHaveLength(1);
  });
});
