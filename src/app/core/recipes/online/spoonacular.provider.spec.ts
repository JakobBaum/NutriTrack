import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SpoonacularProvider } from './spoonacular.provider';
import { RecipeSearchConfigStore } from '../../state/recipe-search-config.store';
import { EMPTY_FILTERS } from './spoonacular.query';

let http: HttpTestingController;
let provider: SpoonacularProvider;
let store: RecipeSearchConfigStore;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(SpoonacularProvider);
  store = TestBed.inject(RecipeSearchConfigStore);
});
afterEach(() => http.verify());

describe('SpoonacularProvider', () => {
  it('fails with a no-key error without calling the API', async () => {
    await expect(provider.search(EMPTY_FILTERS)).rejects.toMatchObject({ reason: 'no-key' });
    http.expectNone(() => true);
  });

  it('sends the key as x-api-key header, maps results and reads the quota', async () => {
    store.setApiKey(' abc ');
    const promise = provider.search({ ...EMPTY_FILTERS, query: 'soup', maxCalories: 400 });
    const req = http.expectOne((r) => r.url === 'https://api.spoonacular.com/recipes/complexSearch');
    expect(req.request.headers.get('x-api-key')).toBe('abc');
    expect(req.request.params.get('maxCalories')).toBe('400');
    req.flush(
      { results: [{ id: 1, title: 'Soup', servings: 2 }, { title: 'broken' }], totalResults: 12 },
      { headers: { 'X-Api-Quota-Left': '37' } },
    );
    const page = await promise;
    expect(page.recipes.map((r) => r.title)).toEqual(['Soup']);
    expect(page.totalResults).toBe(12);
    expect(page.quotaLeft).toBe(37);
    expect(provider.quotaLeft()).toBe(37);
  });

  it('maps HTTP 402 to a quota error', async () => {
    store.setApiKey('abc');
    const promise = provider.search(EMPTY_FILTERS);
    http.expectOne(() => true).flush({}, { status: 402, statusText: 'Payment Required' });
    await expect(promise).rejects.toMatchObject({ reason: 'quota' });
  });

  it('pings with number=1 only, an overridden key and a custom base url', async () => {
    const promise = provider.ping({ apiKey: 'typed', baseUrl: 'https://worker.example/' });
    const req = http.expectOne((r) => r.url === 'https://worker.example/recipes/complexSearch');
    expect(req.request.headers.get('x-api-key')).toBe('typed');
    expect(req.request.params.keys()).toEqual(['number']);
    req.flush({ results: [] }, { headers: { 'X-Api-Quota-Left': '49' } });
    expect(await promise).toBe(49);
  });
});
