import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OpenFoodFactsProvider } from './openfoodfacts.provider';
import { FoodLookupError, foodErrorMessage, toFoodLookupError } from './food-errors';
import { environment } from '../../../environments/environment';

const SEARCH_URL = environment.offSearchUrl;
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v3/product';

let http: HttpTestingController;
let provider: OpenFoodFactsProvider;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(OpenFoodFactsProvider);
});

afterEach(() => http.verify());

/** Holt ein Produkt per Barcode und liefert das gemappte Ergebnis. */
async function mapProduct(product: Record<string, unknown>) {
  const p = provider.lookupByBarcode('123');
  http.expectOne((r) => r.url === `${PRODUCT_URL}/123.json`).flush({ status: 'success', product });
  return p;
}

const base = { product_name: 'Joghurt', nutriments: { 'energy-kcal_100g': 60 } };

// Mapping-Randfälle der OpenFoodFacts-Antworten.
describe('OpenFoodFactsProvider — Mapping', () => {
  it('mappt alle Nährwerte per100g', async () => {
    const item = await mapProduct({
      ...base,
      code: '123',
      nutriments: {
        'energy-kcal_100g': 60, proteins_100g: 3.5, carbohydrates_100g: 4.7,
        fat_100g: 3.3, fiber_100g: 0.2, sugars_100g: 4.7, salt_100g: 0.1,
      },
    });
    expect(item?.facts).toEqual({
      kcal: 60, proteinG: 3.5, carbsG: 4.7, fatG: 3.3, fiberG: 0.2, sugarG: 4.7, saltG: 0.1, basis: 'per100g',
    });
    expect(item?.source).toBe('openfoodfacts');
    expect(item?.barcode).toBe('123');
    expect(item?.id.startsWith('off_')).toBe(true);
  });

  it('setzt fehlende Hauptmakros auf 0, lässt fehlende Ballaststoffe/Zucker/Salz aber leer statt 0 (FDB-01)', async () => {
    const item = await mapProduct(base);
    expect(item?.facts.proteinG).toBe(0);
    expect(item?.facts.fiberG).toBeUndefined();
    expect(item?.facts.sugarG).toBeUndefined();
    expect(item?.facts.saltG).toBeUndefined();
  });

  it('übernimmt vorhandene Salz-, Zucker- und Ballaststoffwerte, auch echte 0 (FDB-01)', async () => {
    const item = await mapProduct({ ...base, nutriments: { 'energy-kcal_100g': 10, salt_100g: 0, sugars_100g: 1.5, fiber_100g: '2' } });
    expect(item?.facts).toMatchObject({ saltG: 0, sugarG: 1.5, fiberG: 2 });
  });

  it('akzeptiert numerische Strings und klemmt negative Werte', async () => {
    const item = await mapProduct({ ...base, nutriments: { 'energy-kcal_100g': '250', fat_100g: -4, proteins_100g: 'abc' } });
    expect(item?.facts.kcal).toBe(250);
    expect(item?.facts.fatG).toBe(0);
    expect(item?.facts.proteinG).toBe(0);
  });

  it('verwirft Produkte ohne/mit leerem Namen oder nicht-numerischen kcal', async () => {
    expect(await mapProduct({ ...base, product_name: '   ' })).toBeNull();
    expect(await mapProduct({ nutriments: base.nutriments })).toBeNull();
    expect(await mapProduct({ ...base, nutriments: { 'energy-kcal_100g': '' } })).toBeNull();
    expect(await mapProduct({ ...base, nutriments: { 'energy-kcal_100g': 'n/a' } })).toBeNull();
    expect(await mapProduct({ ...base, nutriments: undefined })).toBeNull();
  });

  it('verwirft Produkte ohne kcal und ohne kJ (nie still 0 kcal)', async () => {
    expect(await mapProduct({ ...base, nutriments: { energy_100g: 1046 } })).toBeNull();
  });

  // kJ-only-Produkte (in OFF häufig) werden umgerechnet statt verworfen (openfoodfacts.provider.ts, kcal-Ermittlung).
  it('rechnet kJ-only-Produkte in kcal um (1 kcal = 4,184 kJ)', async () => {
    const item = await mapProduct({ ...base, nutriments: { 'energy-kj_100g': 1046 } });
    expect(item?.facts.kcal).toBe(250);
  });

  // Dezimalkomma-Strings („12,5") werden als NaN verworfen bzw. 0.
  // openfoodfacts.provider.ts:145 (num) — erwartet: 12.5, tatsächlich: Produkt verworfen.
  it('akzeptiert Nährwert-Strings mit Dezimalkomma', async () => {
    const item = await mapProduct({ ...base, nutriments: { 'energy-kcal_100g': '12,5' } });
    expect(item?.facts.kcal).toBe(12.5);
  });

  it('nimmt die erste Marke aus String oder Array', async () => {
    expect((await mapProduct({ ...base, brands: 'Ja!, Rewe' }))?.brand).toBe('Ja!');
    expect((await mapProduct({ ...base, brands: ['Spar', 'Despar'] }))?.brand).toBe('Spar');
    expect((await mapProduct(base))?.brand).toBeUndefined();
  });

  it('mappt die Portionsgröße (auch als String) und lässt 0 weg', async () => {
    expect((await mapProduct({ ...base, serving_quantity: '30' }))?.servingG).toBe(30);
    expect((await mapProduct({ ...base, serving_quantity: 0 }))?.servingG).toBeUndefined();
  });

  it('bevorzugt das kleine Bild', async () => {
    expect((await mapProduct({ ...base, image_url: 'big', image_small_url: 'small' }))?.imageUrl).toBe('small');
    expect((await mapProduct({ ...base, image_url: 'big', image_small_url: '' }))?.imageUrl).toBe('big');
  });
});

describe('OpenFoodFactsProvider — Eingaben', () => {
  it('fragt bei leerer Suche/leerem Barcode nichts an', async () => {
    expect(await provider.searchByText('   ')).toEqual([]);
    expect(await provider.lookupByBarcode('  ')).toBeNull();
    http.expectNone(() => true);
  });

  it('kodiert den Barcode und trimmt ihn', async () => {
    const p = provider.lookupByBarcode(' 12/34 ');
    http.expectOne((r) => r.url === `${PRODUCT_URL}/12%2F34.json`).flush({ status: 'failure' });
    expect(await p).toBeNull();
  });

  it('liefert null, wenn v3 kein product enthält', async () => {
    const p = provider.lookupByBarcode('1');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush({ status: 'success' });
    expect(await p).toBeNull();
  });

  it('liefert [] bei Antwort ohne hits und begrenzt page_size auf 50', async () => {
    const p = provider.searchByText('milch', 40);
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    expect(req.request.params.get('page_size')).toBe('50');
    req.flush({});
    expect(await p).toEqual([]);
  });

  it('nutzt autocomplete mit Standardlimit 6', async () => {
    const p = provider.autocomplete('kä');
    const req = http.expectOne((r) => r.url === SEARCH_URL);
    expect(req.request.params.get('page_size')).toBe('12');
    req.flush({ hits: [] });
    expect(await p).toEqual([]);
  });

  it('meldet Barcode-Serverfehler als FoodLookupError', async () => {
    const p = provider.lookupByBarcode('1');
    http.expectOne((r) => r.url.startsWith(PRODUCT_URL)).flush(null, { status: 500, statusText: 'Err' });
    await expect(p).rejects.toMatchObject({ reason: 'server' });
  });
});

describe('toFoodLookupError / foodErrorMessage', () => {
  it('reicht FoodLookupError unverändert durch', () => {
    const e = new FoodLookupError('offline', 'x');
    expect(toFoodLookupError(e)).toBe(e);
  });

  it('klassifiziert HTTP-Status und Nicht-HTTP-Fehler', () => {
    expect(toFoodLookupError(new HttpErrorResponse({ status: 429 })).reason).toBe('rate-limit');
    const s503 = toFoodLookupError(new HttpErrorResponse({ status: 503 }));
    expect(s503.reason).toBe('server');
    expect(s503.message).toMatch(/^HTTP 503/);
    expect(toFoodLookupError(new Error('boom')).message).toBe('boom');
    expect(toFoodLookupError('text').message).toBe('text');
    expect(toFoodLookupError(undefined).name).toBe('FoodLookupError');
  });

  it('liefert eine generische Meldung für fremde Fehler', () => {
    expect(foodErrorMessage(new Error('x'))).toBe('Abfrage fehlgeschlagen — bitte erneut versuchen.');
    expect(foodErrorMessage(null)).toMatch(/erneut versuchen/);
  });
});
