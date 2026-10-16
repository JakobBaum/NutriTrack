import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { OpenFoodFactsProvider } from './openfoodfacts.provider';

const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v3/product';

function product(name: string) {
  return {
    code: '111',
    product_name: name,
    brands: 'Marke',
    nutriments: { 'energy-kcal_100g': 123, proteins_100g: 5 },
  };
}

let http: HttpTestingController;
let provider: OpenFoodFactsProvider;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(OpenFoodFactsProvider);
});

afterEach(() => http.verify());

describe('OpenFoodFactsProvider — Suche (search-a-licious)', () => {
  it('nutzt /search mit q + page_size und mappt hits', async () => {
    // Act
    const promise = provider.searchByText('reis', 20);
    const req: TestRequest = http.expectOne((r) => r.url === SEARCH_URL);

    // Assert
    expect(req.request.params.get('q')).toBe('reis');
    expect(req.request.params.get('page_size')).toBe('20');
    req.flush({ hits: [product('Reis')] });
    const items = await promise;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Reis');
    expect(items[0].facts.kcal).toBe(123);
  });

  it('liefert [] bei 404 (nicht gefunden ist kein Netzwerkfehler)', async () => {
    // Act
    const promise = provider.searchByText('gibtsnicht');
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    // Assert
    await expect(promise).resolves.toEqual([]);
  });

  it('wirft bei echtem Serverfehler (500) weiter', async () => {
    // Act
    const promise = provider.searchByText('reis');
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    // Assert
    await expect(promise).rejects.toBeTruthy();
  });
});

describe('OpenFoodFactsProvider — Barcode (v3)', () => {
  it('liefert null bei 404 statt zu werfen', async () => {
    // Act
    const promise = provider.lookupByBarcode('000');
    const req = http.expectOne((r) => r.url === `${PRODUCT_URL}/000.json`);
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    // Assert
    await expect(promise).resolves.toBeNull();
  });

  it('liefert null bei status "failure" (v3: Produkt nicht gefunden)', async () => {
    // Act
    const promise = provider.lookupByBarcode('123');
    const req = http.expectOne((r) => r.url === `${PRODUCT_URL}/123.json`);
    req.flush({ status: 'failure' });

    // Assert
    await expect(promise).resolves.toBeNull();
  });

  it('mappt einen Treffer', async () => {
    // Act
    const promise = provider.lookupByBarcode('111');
    const req = http.expectOne((r) => r.url === `${PRODUCT_URL}/111.json`);
    req.flush({ status: 'success', product: product('Nutella') });

    // Assert
    const item = await promise;
    expect(item?.name).toBe('Nutella');
  });
});
