import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProxyAiProvider } from './proxy-ai-provider';
import { ConsentService } from '../consent/consent.service';
import { ConsentRequiredError } from '../consent/consent.errors';
import { environment } from '../../../environments/environment';

const PROXY = 'https://proxy.test/ai';
const REQ = { restaurant: 'X', kcalBudget: 300 };

let http: HttpTestingController;
let provider: ProxyAiProvider;
const state = { granted: false };
const ensure = vi.fn<() => Promise<boolean>>();

beforeEach(() => {
  localStorage.clear();
  environment.aiProxyUrl = PROXY;
  state.granted = false;
  ensure.mockReset();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConsentService, useValue: { ensure, isGranted: () => state.granted } },
    ],
  });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(ProxyAiProvider);
});

afterEach(() => {
  http.verify();
  environment.aiProxyUrl = '';
});

describe('ProxyAiProvider ohne Zustimmung', () => {
  it('sendet bei abgelehntem Dialog nichts und wirft den Zustimmungs-Fehler', async () => {
    ensure.mockResolvedValue(false);
    await expect(provider.suggestFastfood(REQ)).rejects.toBeInstanceOf(ConsentRequiredError);
    http.expectNone(() => true);
  });

  it('öffnet für Fotos, Import und Einkaufsliste den Dialog (vom Nutzer ausgelöst)', async () => {
    ensure.mockResolvedValue(false);
    await expect(provider.recognizeLabel('abc', 'per100g')).rejects.toBeInstanceOf(ConsentRequiredError);
    await expect(provider.importRecipe({ text: 'x' })).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(ensure).toHaveBeenCalledTimes(2);
    http.expectNone(() => true);
  });

  it('öffnet bei Hintergrund-Übersetzungen keinen Dialog und sendet nichts', async () => {
    await expect(provider.translateSearchQuery('Apfel', 'de')).rejects.toBeInstanceOf(ConsentRequiredError);
    await expect(provider.translateRecipe({ title: 't', ingredients: [], steps: [] }, 'de')).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(ensure).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('sendet nach der Zustimmung im Dialog', async () => {
    ensure.mockResolvedValue(true);
    const promise = provider.suggestFastfood(REQ);
    await vi.waitFor(() => http.expectOne(PROXY).flush([]));
    await expect(promise).resolves.toEqual([]);
  });

  it('sendet ohne Dialog, wenn schon zugestimmt ist', async () => {
    state.granted = true;
    const promise = provider.translateSearchQuery('Apfel', 'de');
    http.expectOne(PROXY).flush({ query: 'apple' });
    await expect(promise).resolves.toBe('apple');
    expect(ensure).not.toHaveBeenCalled();
  });

  it('der Erreichbarkeitstest ping braucht keine Zustimmung', async () => {
    const promise = provider.ping();
    http.expectOne(PROXY).flush({ error: 'Unbekannte Funktion' }, { status: 400, statusText: 'Bad Request' });
    await expect(promise).resolves.toBeUndefined();
    expect(ensure).not.toHaveBeenCalled();
  });
});
