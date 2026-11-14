import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OpenFoodFactsProvider } from './openfoodfacts.provider';
import { FoodLookupError, foodErrorMessage } from './food-errors';
import { DebugLogService } from '../debug/debug-log.service';
import { STATE_MESSAGES } from '../messages/state-messages';
import { environment } from '../../../environments/environment';

const SEARCH_URL = environment.offSearchUrl;
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v3/product';

const faultyProduct = {
  code: '999',
  product_name: 'Fehlerhaft',
  brands: 'Marke',
  nutriments: { 'energy-kcal_100g': 5000, proteins_100g: 5 },
};

let http: HttpTestingController;
let provider: OpenFoodFactsProvider;
let log: DebugLogService;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(OpenFoodFactsProvider);
  log = TestBed.inject(DebugLogService);
});

afterEach(() => http.verify());

describe('OpenFoodFactsProvider mit offensichtlich fehlerhaften Werten', () => {
  it('wirft beim Barcode einen eigenen Fehlergrund statt "nicht gefunden"', async () => {
    const promise = provider.lookupByBarcode('999');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'success', product: faultyProduct });
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoodLookupError);
    expect((error as FoodLookupError).reason).toBe('implausible');
  });

  it('zeigt dafür den Hinweis mit dem Weg zu Etikett und Handeingabe', async () => {
    const promise = provider.lookupByBarcode('999');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'success', product: faultyProduct });
    const error = await promise.catch((e: unknown) => e);
    expect(foodErrorMessage(error)).toBe(STATE_MESSAGES.foodImplausible);
    expect(STATE_MESSAGES.foodImplausible).toBe(
      'Die Daten zu diesem Produkt sind offensichtlich fehlerhaft. Scanne das Etikett oder trage die Werte von Hand ein.',
    );
  });

  it('liefert bei einem Barcode ohne Produkt weiterhin null', async () => {
    const promise = provider.lookupByBarcode('000');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'failure' });
    await expect(promise).resolves.toBeNull();
  });

  it('verwirft den Treffer in der Textsuche still', async () => {
    const promise = provider.searchByText('fehler');
    http.expectOne((r) => r.url === SEARCH_URL).flush({ hits: [faultyProduct] });
    await expect(promise).resolves.toEqual([]);
  });

  it('protokolliert den verworfenen Suchtreffer als Info und nicht als Fehler', async () => {
    const promise = provider.searchByText('fehler');
    http.expectOne((r) => r.url === SEARCH_URL).flush({ hits: [faultyProduct] });
    await promise;
    const dropped = log.entries().filter((e) => e.msg.includes('Unplausible'));
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((e) => e.level === 'info')).toBe(true);
  });
});
