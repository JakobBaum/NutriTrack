import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { OpenFoodFactsProvider } from './openfoodfacts.provider';
import { FoodLookupError, foodErrorMessage } from './food-errors';
import { environment } from '../../../environments/environment';

const SEARCH_URL = environment.offSearchUrl;
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v3/product';

function product(name: string, extra: Record<string, unknown> = {}) {
  return {
    code: '111',
    product_name: name,
    brands: 'Marke',
    nutriments: { 'energy-kcal_100g': 123, proteins_100g: 5 },
    ...extra,
  };
}

let http: HttpTestingController;
let provider: OpenFoodFactsProvider;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(OpenFoodFactsProvider);
});

afterEach(() => http.verify());

describe('OpenFoodFactsProvider — fehlende Nährwerte', () => {
  it('verwirft Suchtreffer ohne kcal statt sie als 0 kcal zu speichern', async () => {
    // Arrange
    const promise = provider.searchByText('reis');
    const req = http.expectOne((r) => r.url === SEARCH_URL);

    // Act
    req.flush({
      hits: [product('Ohne Werte', { nutriments: {} }), product('Mit Werten'), product('Wasser', { nutriments: { 'energy-kcal_100g': 0 } })],
    });
    const items = await promise;

    // Assert
    expect(items.map((i) => i.name)).toEqual(['Mit Werten', 'Wasser']);
  });

  it('liefert bei Barcode-Produkt ohne kcal null', async () => {
    // Arrange
    const promise = provider.lookupByBarcode('111');
    const req = http.expectOne((r) => r.url.startsWith(PRODUCT_URL));

    // Act
    req.flush({ status: 'success', product: product('Ohne Werte', { nutriments: {} }) });

    // Assert
    expect(await promise).toBeNull();
  });
});

describe('OpenFoodFactsProvider — Suche (search-a-licious)', () => {
  it('nutzt /search mit q und mappt hits', async () => {
    // Act
    const promise = provider.searchByText('reis', 20);
    const req: TestRequest = http.expectOne((r) => r.url === SEARCH_URL);

    // Assert
    expect(req.request.params.get('q')).toBe('reis');
    req.flush({ hits: [product('Reis')] });
    const items = await promise;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Reis');
    expect(items[0].facts.kcal).toBe(123);
  });

  it('sendet keinen User-Agent-Header (löst in Safari/Firefox einen CORS-Preflight aus)', async () => {
    // Act
    const promise = provider.searchByText('reis');
    const req = http.expectOne((r) => r.url === SEARCH_URL);

    // Assert
    expect(req.request.headers.has('User-Agent')).toBe(false);
    req.flush({ hits: [] });
    await promise;
  });

  it('holt mehr Kandidaten und liefert höchstens limit Treffer', async () => {
    // Arrange
    const hits = Array.from({ length: 8 }, (_, i) => product(`Reis ${i}`));

    // Act
    const promise = provider.searchByText('reis', 3);
    const req = http.expectOne((r) => r.url === SEARCH_URL);

    // Assert
    expect(Number(req.request.params.get('page_size'))).toBeGreaterThan(3);
    req.flush({ hits });
    await expect(promise).resolves.toHaveLength(3);
  });

  it('sortiert Produkte aus dem DACH-Raum bzw. mit deutschem Namen nach vorne', async () => {
    // Arrange
    const hits = [
      product('Pomme jaune', { lang: 'fr', countries_tags: ['en:france'] }),
      product('Apfel Chips', { lang: 'de', countries_tags: ['en:france'] }),
      product('Äpfel aus Österreich', { lang: 'de', countries_tags: ['en:austria'] }),
    ];

    // Act
    const promise = provider.searchByText('apfel');
    http.expectOne((r) => r.url === SEARCH_URL).flush({ hits });

    // Assert
    const names = (await promise).map((i) => i.name);
    expect(names).toEqual(['Äpfel aus Österreich', 'Apfel Chips', 'Pomme jaune']);
  });

  it('liefert [] bei 404 (nicht gefunden ist kein Netzwerkfehler)', async () => {
    // Act
    const promise = provider.searchByText('gibtsnicht');
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    // Assert
    await expect(promise).resolves.toEqual([]);
  });

  it('meldet 429 als Rate-Limit statt als Netzwerkfehler', async () => {
    // Act
    const promise = provider.searchByText('reis');
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    req.flush('slow down', { status: 429, statusText: 'Too Many Requests' });

    // Assert
    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FoodLookupError);
    expect((err as FoodLookupError).reason).toBe('rate-limit');
  });

  describe('status 0', () => {
    afterEach(() => vi.restoreAllMocks());

    it('meldet status 0 als offline, wenn das Gerät kein Netz hat', async () => {
      // Arrange
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      // Act
      const promise = provider.searchByText('reis');
      const req = http.expectOne((r) => r.url === SEARCH_URL);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      // Assert
      const err = await promise.catch((e: unknown) => e);
      expect((err as FoodLookupError).reason).toBe('offline');
    });

    it('meldet status 0 als Serverproblem, wenn das Gerät online ist (z. B. CORS-Abweisung)', async () => {
      // Arrange
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      // Act
      const promise = provider.searchByText('reis');
      const req = http.expectOne((r) => r.url === SEARCH_URL);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      // Assert
      const err = await promise.catch((e: unknown) => e);
      expect((err as FoodLookupError).reason).toBe('server');
    });
  });

  it('wirft bei echtem Serverfehler (500) weiter', async () => {
    // Act
    const promise = provider.searchByText('reis');
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    // Assert
    const err = await promise.catch((e: unknown) => e);
    expect((err as FoodLookupError).reason).toBe('server');
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

  it('mappt einen Treffer ohne User-Agent-Header', async () => {
    // Act
    const promise = provider.lookupByBarcode('111');
    const req = http.expectOne((r) => r.url === `${PRODUCT_URL}/111.json`);

    // Assert
    expect(req.request.headers.has('User-Agent')).toBe(false);
    req.flush({ status: 'success', product: product('Nutella') });
    const item = await promise;
    expect(item?.name).toBe('Nutella');
  });

  it('meldet 429 beim Barcode als Rate-Limit', async () => {
    // Act
    const promise = provider.lookupByBarcode('111');
    const req = http.expectOne((r) => r.url === `${PRODUCT_URL}/111.json`);
    req.flush('slow down', { status: 429, statusText: 'Too Many Requests' });

    // Assert
    const err = await promise.catch((e: unknown) => e);
    expect((err as FoodLookupError).reason).toBe('rate-limit');
  });
});

describe('foodErrorMessage', () => {
  it('liefert verständliche Texte je Fehlerart', () => {
    // Assert
    expect(foodErrorMessage(new FoodLookupError('rate-limit', 'x'))).toContain('Zu viele Anfragen');
    expect(foodErrorMessage(new FoodLookupError('offline', 'x'))).toContain('Keine Internetverbindung');
    expect(foodErrorMessage(new FoodLookupError('server', 'x'))).toContain('nicht erreichbar');
    expect(foodErrorMessage(new Error('?'))).toContain('Versuche es erneut');
  });

  it('nennt bei Serverproblem die Datenbank, nicht das Internet', () => {
    // Act
    const message = foodErrorMessage(new FoodLookupError('server', 'x'));

    // Assert
    expect(message).toBe(
      'Die Lebensmittel-Datenbank ist gerade nicht erreichbar. Versuche es später erneut.',
    );
    expect(message).not.toContain('Internet');
  });

  it('nennt bei Offline das Internet', () => {
    // Act
    const message = foodErrorMessage(new FoodLookupError('offline', 'x'));

    // Assert
    expect(message).toBe('Keine Internetverbindung. Prüfe WLAN oder Mobilnetz und versuche es erneut.');
  });
});
