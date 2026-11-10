import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OpenPricesProvider } from './open-prices.provider';

const PRICES_URL = 'https://prices.openfoodfacts.org/api/v1/prices';

let http: HttpTestingController;
let provider: OpenPricesProvider;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(OpenPricesProvider);
});

afterEach(() => http.verify());

/** Fragt einen Barcode ab und beantwortet mit `items`. */
async function priceFor(items: unknown) {
  const p = provider.priceByBarcode('400');
  http.expectOne((r) => r.url === PRICES_URL).flush({ items });
  return p;
}

describe('OpenPricesProvider', () => {
  it('gibt nach Zeitlimit null zurueck, statt ewig zu warten', async () => {
    vi.useFakeTimers();
    try {
      const p = provider.priceByBarcode('400');
      http.expectOne((r) => r.url === PRICES_URL);
      await vi.advanceTimersByTimeAsync(11000);
      expect(await p).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fragt bei leerem Barcode nichts an', async () => {
    expect(await provider.priceByBarcode('  ')).toBeNull();
    http.expectNone(() => true);
  });

  it('sendet Barcode, Sortierung und Limit', async () => {
    const p = provider.priceByBarcode(' 400 ', 5);
    const req = http.expectOne((r) => r.url === PRICES_URL);
    expect(req.request.params.get('product_code')).toBe('400');
    expect(req.request.params.get('order_by')).toBe('-date');
    expect(req.request.params.get('size')).toBe('5');
    req.flush({ items: [] });
    expect(await p).toBeNull();
  });

  it('liefert null bei Netzwerkfehler', async () => {
    const p = provider.priceByBarcode('400');
    http.expectOne((r) => r.url === PRICES_URL).flush(null, { status: 500, statusText: 'Err' });
    expect(await p).toBeNull();
  });

  it('liefert null ohne items oder nur ungültigen Preisen', async () => {
    expect(await priceFor(undefined)).toBeNull();
    expect(await priceFor([{ price: 0 }, { price: -1 }, { price: '1.99' }, {}])).toBeNull();
  });

  it('mittelt EUR-Preise, rundet auf Cent und ignoriert andere Währungen', async () => {
    const res = await priceFor([
      { price: 1, currency: 'EUR' },
      { price: 1.255, currency: 'eur' },
      { price: 9, currency: 'CHF' },
      { price: 2 }, // ohne Währung → EUR
    ]);
    expect(res).toEqual({ avg: 1.42, currency: 'EUR', count: 3 });
  });

  it('nutzt fremde Währung, wenn kein EUR-Preis vorliegt', async () => {
    const res = await priceFor([{ price: 3, currency: 'chf' }, { price: 5, currency: 'CHF' }]);
    expect(res).toEqual({ avg: 4, currency: 'CHF', count: 2 });
  });
});
