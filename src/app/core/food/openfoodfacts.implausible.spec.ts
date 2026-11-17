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

describe('OpenFoodFactsProvider — Energie gegen Makros (K4)', () => {
  const kjInKcal = {
    code: '111', product_name: 'Joghurt', nutriments: { 'energy-kcal_100g': 418, 'energy-kj_100g': 418, proteins_100g: 5, carbohydrates_100g: 15, fat_100g: 2 },
  };
  const zeroKcal = {
    code: '222', product_name: 'Nussmix', nutriments: { 'energy-kcal_100g': 0, proteins_100g: 20, carbohydrates_100g: 10, fat_100g: 50 },
  };

  it('verwirft in der Suche einen kJ-Wert im kcal-Feld und kcal 0 bei vollen Makros', async () => {
    const promise = provider.searchByText('x');
    http.expectOne((r) => r.url === SEARCH_URL).flush({ hits: [kjInKcal, zeroKcal] });
    await expect(promise).resolves.toEqual([]);
  });

  it('meldet beim Barcode "fehlerhaft" statt eines falschen Treffers', async () => {
    const promise = provider.lookupByBarcode('222');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'success', product: zeroKcal });
    const error = await promise.catch((e: unknown) => e);
    expect((error as FoodLookupError).reason).toBe('implausible');
  });
});

describe('OpenFoodFactsProvider — Produkt ohne Nährwerte (K13)', () => {
  const noNutrition = { code: '333', product_name: 'Mystery-Riegel', brands: 'Marke', nutriments: {} };

  it('wirft beim Barcode einen eigenen Fehlergrund statt "kein Produkt gefunden"', async () => {
    const promise = provider.lookupByBarcode('333');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'success', product: noNutrition });
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoodLookupError);
    expect((error as FoodLookupError).reason).toBe('no-nutrition');
  });

  it('nennt die Meldung mit dem Weg zur Handeingabe', async () => {
    const promise = provider.lookupByBarcode('333');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'success', product: noNutrition });
    const error = await promise.catch((e: unknown) => e);
    expect(foodErrorMessage(error)).toBe('Produkt gefunden, aber ohne Nährwerte. Bitte manuell eintragen.');
  });

  it('lässt solche Produkte in der Textsuche weiter still weg', async () => {
    const promise = provider.searchByText('mystery');
    http.expectOne((r) => r.url === SEARCH_URL).flush({ hits: [noNutrition] });
    await expect(promise).resolves.toEqual([]);
  });
});

describe('OpenFoodFactsProvider — Zahlen aus OFF (K15)', () => {
  it('liest "1.500" als 1,5 und nicht als 1500', async () => {
    const promise = provider.lookupByBarcode('444');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({
      status: 'success',
      product: {
        code: '444', product_name: 'Tee', nutriments: { 'energy-kcal_100g': '10', proteins_100g: '1.500', carbohydrates_100g: '1.500', fat_100g: '0' },
      },
    });
    const item = await promise;
    expect(item?.facts.proteinG).toBe(1.5);
  });
});

describe('OpenFoodFactsProvider — zweifelhafte Energie wird markiert statt verworfen (Prüfrunde 2)', () => {
  const wine = {
    code: '444', product_name: 'Rotwein',
    nutriments: { 'energy-kcal_100g': 80, proteins_100g: 0.1, carbohydrates_100g: 2.6, fat_100g: 0 },
  };
  const erythritol = {
    code: '555', product_name: 'Erythrit',
    nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 100, fat_100g: 0 },
  };

  it('liefert Wein und Erythrit; nur Erythrit ist "bitte prüfen"', async () => {
    const promise = provider.searchByText('x');
    http.expectOne((r) => r.url === SEARCH_URL).flush({ hits: [wine, erythritol] });
    const items = await promise;
    expect(items.map((i) => i.name).sort()).toEqual(['Erythrit', 'Rotwein']);
    expect(items.find((i) => i.name === 'Rotwein')?.isKcalDoubtful).toBeUndefined();
    expect(items.find((i) => i.name === 'Erythrit')?.isKcalDoubtful).toBe(true);
  });
});
