import { FoodItem } from '../core/models';
import { DiarySearch } from './diary-search';

const item = (name: string): FoodItem => ({ id: name, name, facts: { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, basis: 'per100g' } }) as FoodItem;

describe('DiarySearch.pickFirst', () => {
  it('searches the current query and returns the first result', async () => {
    const search = new DiarySearch({ searchByText: async (q) => [item(`${q} 1`), item(`${q} 2`)] }, () => undefined);
    search.query = 'hafer';

    const first = await search.pickFirst();

    expect(first?.name).toBe('hafer 1');
  });

  it('does not reuse results of an older query', async () => {
    const calls: string[] = [];
    const search = new DiarySearch({ searchByText: async (q) => { calls.push(q); return [item(q)]; } }, () => undefined);
    search.query = 'ha';
    await search.run();
    search.query = 'hafer';

    const first = await search.pickFirst();

    expect(calls).toEqual(['ha', 'hafer']);
    expect(first?.name).toBe('hafer');
  });

  it('returns null when nothing is found or the query is too short', async () => {
    const search = new DiarySearch({ searchByText: async () => [] }, () => undefined);
    search.query = 'zzz';
    expect(await search.pickFirst()).toBeNull();
    search.query = 'z';
    expect(await search.pickFirst()).toBeNull();
  });
});
