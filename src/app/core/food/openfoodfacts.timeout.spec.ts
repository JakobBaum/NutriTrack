import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OpenFoodFactsProvider } from './openfoodfacts.provider';
import { FOOD_TIMEOUT_MS } from './food-errors';
import { environment } from '../../../environments/environment';
import { FoodLookupError, foodErrorMessage } from './food-errors';

let http: HttpTestingController;
let provider: OpenFoodFactsProvider;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(OpenFoodFactsProvider);
});

afterEach(() => vi.useRealTimers());

describe('OpenFoodFactsProvider — Zeitlimit (STA-01)', () => {
  it('bricht eine hängende Textsuche nach dem Zeitlimit mit klarer Meldung ab', async () => {
    // Arrange
    const promise = provider.searchByText('reis').catch((e: unknown) => e);
    http.expectOne((r) => r.url === environment.offSearchUrl);

    // Act
    await vi.advanceTimersByTimeAsync(FOOD_TIMEOUT_MS + 1);
    const err = await promise;

    // Assert
    expect(err).toBeInstanceOf(FoodLookupError);
    expect((err as FoodLookupError).reason).toBe('timeout');
    expect(foodErrorMessage(err)).toContain('antwortet gerade nicht');
  });

  it('bricht auch einen hängenden Barcode-Abruf ab', async () => {
    const promise = provider.lookupByBarcode('123').catch((e: unknown) => e);
    http.expectOne((r) => r.url.includes('/api/v3/product/123.json'));

    await vi.advanceTimersByTimeAsync(FOOD_TIMEOUT_MS + 1);

    expect(((await promise) as FoodLookupError).reason).toBe('timeout');
  });

  it('lässt eine rechtzeitige Antwort unverändert durch', async () => {
    const promise = provider.searchByText('reis');
    http.expectOne((r) => r.url === environment.offSearchUrl).flush({ hits: [] });

    expect(await promise).toEqual([]);
  });
});
