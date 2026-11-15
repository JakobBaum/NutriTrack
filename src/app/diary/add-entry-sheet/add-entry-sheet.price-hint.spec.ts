import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenPricesProvider, PriceInfo } from '../../core/price/open-prices.provider';
import { FoodSourceResult } from '../../shared/food-sources/food-sources.component';
import { AddEntrySheetComponent } from './add-entry-sheet.component';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const priceByBarcode = vi.fn<(code: string) => Promise<PriceInfo | null>>();

const source = (code: string): FoodSourceResult => ({
  source: 'barcode', name: `Produkt ${code}`, code,
  facts: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'per100g' },
});

function setup(): AddEntrySheetComponent {
  localStorage.clear();
  priceByBarcode.mockReset();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [AddEntrySheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: OpenPricesProvider, useValue: { priceByBarcode } },
      { provide: ToastController, useValue: { create: vi.fn() } },
      { provide: ActionSheetController, useValue: { create: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AddEntrySheetComponent);
  fixture.componentRef.setInput('date', '2026-11-14');
  return fixture.componentInstance;
}

describe('AddEntrySheetComponent: Preishinweis', () => {
  let sheet: AddEntrySheetComponent;
  beforeEach(() => { sheet = setup(); });

  it('zeigt bei zwei ueberlappenden Anfragen nur den Preis der letzten Zutat', async () => {
    const slow = deferred<PriceInfo | null>();
    const fast = deferred<PriceInfo | null>();
    priceByBarcode.mockImplementation((code) => (code === 'A' ? slow.promise : fast.promise));

    sheet.onSource(source('A'));
    sheet.onSource(source('B'));
    fast.resolve({ avg: 2, currency: 'EUR', count: 1 });
    await fast.promise;
    await Promise.resolve();
    slow.resolve({ avg: 9, currency: 'EUR', count: 1 });
    await slow.promise;
    await Promise.resolve();

    expect(sheet.formHint()).toContain('2,00');
    expect(sheet.formHint()).not.toContain('9,00');
  });

  it('verwirft eine verspaetete Antwort, wenn das Formular inzwischen zurueckgesetzt wurde', async () => {
    const late = deferred<PriceInfo | null>();
    priceByBarcode.mockReturnValue(late.promise);

    sheet.onSource(source('A'));
    sheet.openManualEntry();
    late.resolve({ avg: 9, currency: 'EUR', count: 1 });
    await late.promise;
    await Promise.resolve();

    expect(sheet.formHint()).toBeNull();
  });

  it('zeigt den Preis, wenn die einzige Anfrage aktuell bleibt', async () => {
    priceByBarcode.mockResolvedValue({ avg: 1.5, currency: 'EUR', count: 2 });
    sheet.onSource(source('A'));
    await Promise.resolve();
    await Promise.resolve();
    expect(sheet.formHint()).toContain('1,50');
  });
});
