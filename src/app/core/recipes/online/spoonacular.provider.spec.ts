import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SpoonacularProvider } from './spoonacular.provider';
import { AI_TIMEOUT_MS } from '../../ai/ai-errors';
import { environment } from '../../../../environments/environment';
import { ConsentStore } from '../../consent/consent.store';
import { EMPTY_FILTERS } from './spoonacular.query';

const WORKER = 'https://nutritrack.example.workers.dev';

let http: HttpTestingController;
let provider: SpoonacularProvider;

beforeEach(() => {
  localStorage.clear();
  environment.aiProxyUrl = '';
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(SpoonacularProvider);
  TestBed.inject(ConsentStore).grant(new Date(), true);
});
afterEach(() => http.verify());

describe('SpoonacularProvider (ohne Worker)', () => {
  it('fails with a no-key error without calling the API when no worker exists', async () => {
    await expect(provider.search(EMPTY_FILTERS)).rejects.toMatchObject({ reason: 'no-key' });
    http.expectNone(() => true);
  });
});

describe('SpoonacularProvider (Worker)', () => {
  it('calls the worker route without x-api-key and keeps all query params', async () => {
    environment.aiProxyUrl = WORKER + '/';
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

  it('maps a worker 503 "nicht eingerichtet" to no-key and makes no second request', async () => {
    environment.aiProxyUrl = WORKER;
    const promise = provider.search(EMPTY_FILTERS);
    http.expectOne(() => true).flush(
      { error: 'Rezept-Suche nicht eingerichtet.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await expect(promise).rejects.toMatchObject({ reason: 'no-key' });
    http.expectNone(() => true);
  });

  it('maps a worker 429 to rate-limit', async () => {
    environment.aiProxyUrl = WORKER;
    const promise = provider.search(EMPTY_FILTERS);
    http.expectOne(() => true).flush({ error: 'x' }, { status: 429, statusText: 'Too Many Requests' });
    await expect(promise).rejects.toMatchObject({ reason: 'rate-limit' });
  });

  it('turns a client timeout into a readable timeout error', async () => {
    vi.useFakeTimers();
    try {
      environment.aiProxyUrl = WORKER;
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
