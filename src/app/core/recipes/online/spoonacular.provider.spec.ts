import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SpoonacularProvider } from './spoonacular.provider';
import { RecipeSearchConfigStore } from '../../state/recipe-search-config.store';
import { SettingsStore } from '../../state/settings.store';
import { AI_TIMEOUT_MS } from '../../ai/ai-errors';
import { environment } from '../../../../environments/environment';
import { EMPTY_FILTERS } from './spoonacular.query';

const WORKER = 'https://nutritrack.example.workers.dev';

let http: HttpTestingController;
let provider: SpoonacularProvider;
let store: RecipeSearchConfigStore;
let settings: SettingsStore;

beforeEach(() => {
  localStorage.clear();
  environment.aiProxyUrl = '';
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(SpoonacularProvider);
  store = TestBed.inject(RecipeSearchConfigStore);
  settings = TestBed.inject(SettingsStore);
});
afterEach(() => http.verify());

describe('SpoonacularProvider (own key)', () => {
  it('fails with a no-key error without calling the API when neither key nor worker exist', async () => {
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

describe('SpoonacularProvider (worker mode, no own key)', () => {
  const aiWith = (proxyUrl: string) => ({ ...settings.ai(), proxyUrl });

  it('calls the worker route without x-api-key and keeps all query params', async () => {
    settings.setAi(aiWith(WORKER + '/'));
    const promise = provider.search({ ...EMPTY_FILTERS, query: 'soup', maxCalories: 400 });
    const req = http.expectOne((r) => r.url === `${WORKER}/recipes/complexSearch`);
    expect(req.request.headers.has('x-api-key')).toBe(false);
    expect(req.request.params.get('query')).toBe('soup');
    expect(req.request.params.get('maxCalories')).toBe('400');
    req.flush({ results: [], totalResults: 0 }, { headers: { 'X-Api-Quota-Left': '12' } });
    await promise;
    expect(provider.quotaLeft()).toBe(12);
  });

  it('uses the global default worker url from the environment', async () => {
    environment.aiProxyUrl = WORKER;
    const promise = provider.search(EMPTY_FILTERS);
    const req = http.expectOne((r) => r.url === `${WORKER}/recipes/complexSearch`);
    expect(req.request.headers.has('x-api-key')).toBe(false);
    req.flush({ results: [] });
    await promise;
  });

  it('prefers an own key over the worker', async () => {
    settings.setAi(aiWith(WORKER));
    store.setApiKey('mine');
    const promise = provider.search(EMPTY_FILTERS);
    const req = http.expectOne((r) => r.url === 'https://api.spoonacular.com/recipes/complexSearch');
    expect(req.request.headers.get('x-api-key')).toBe('mine');
    req.flush({ results: [] });
    await promise;
  });

  it('maps a worker 503 "nicht eingerichtet" to no-key and makes no second request', async () => {
    settings.setAi(aiWith(WORKER));
    const promise = provider.search(EMPTY_FILTERS);
    http.expectOne(() => true).flush(
      { error: 'Rezept-Suche nicht eingerichtet.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await expect(promise).rejects.toMatchObject({ reason: 'no-key' });
    http.expectNone(() => true);
  });

  it('maps a worker 429 to rate-limit', async () => {
    settings.setAi(aiWith(WORKER));
    const promise = provider.search(EMPTY_FILTERS);
    http.expectOne(() => true).flush({ error: 'x' }, { status: 429, statusText: 'Too Many Requests' });
    await expect(promise).rejects.toMatchObject({ reason: 'rate-limit' });
  });

  it('turns a client timeout into a readable timeout error', async () => {
    vi.useFakeTimers();
    try {
      settings.setAi(aiWith(WORKER));
      const promise = provider.search(EMPTY_FILTERS);
      const assertion = expect(promise).rejects.toMatchObject({ reason: 'timeout' });
      await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS + 1);
      await assertion;
      http.match(() => true);
    } finally {
      vi.useRealTimers();
    }
  });
});
