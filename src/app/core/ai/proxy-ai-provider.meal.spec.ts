import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProxyAiProvider } from './proxy-ai-provider';
import { ConsentService } from '../consent/consent.service';
import { ConsentRequiredError } from '../consent/consent.errors';
import { AI_ERROR_MESSAGES } from './ai-errors';
import { MAX_MEAL_TEXT_CHARS } from './meal-parse';
import { environment } from '../../../environments/environment';

const PROXY = 'https://proxy.test/ai';
const ITEM = { name: 'Apfel', amount: 1, unit: 'Stk', portionG: 150, per100g: { kcal: 52, proteinG: 0.3, carbsG: 12, fatG: 0.2 } };

let http: HttpTestingController;
let provider: ProxyAiProvider;
const state = { granted: true };
const ensure = vi.fn<() => Promise<boolean>>();

beforeEach(() => {
  localStorage.clear();
  environment.aiProxyUrl = PROXY;
  state.granted = true;
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

describe('ProxyAiProvider.parseMeal', () => {
  it('sendet fn parseMeal mit { text } (getrimmt) und liefert geprüfte Zeilen', async () => {
    const promise = provider.parseMeal('  ein Apfel  ');
    const req = await vi.waitFor(() => http.expectOne(PROXY));
    expect(req.request.body).toEqual({ fn: 'parseMeal', payload: { text: 'ein Apfel' } });
    req.flush({ items: [ITEM, { ...ITEM, portionG: 99999 }] });
    const result = await promise;
    expect(result.items).toHaveLength(1);
    expect(result.droppedCount).toBe(1);
    expect(result.items[0].per100g.basis).toBe('per100g');
  });

  it('liefert eine leere Liste, wenn alles durchfällt (kein Fehler)', async () => {
    const promise = provider.parseMeal('Zeug');
    (await vi.waitFor(() => http.expectOne(PROXY))).flush({ items: [{ name: 'x' }] });
    await expect(promise).resolves.toEqual({ items: [], droppedCount: 1 });
  });

  it('wirft "nicht lesbar" bei einer Antwort ohne items-Liste', async () => {
    const promise = provider.parseMeal('Zeug');
    (await vi.waitFor(() => http.expectOne(PROXY))).flush({ foo: 1 });
    await expect(promise).rejects.toThrow(AI_ERROR_MESSAGES.unreadable);
  });

  it('wirft "nicht lesbar" bei null als Antwort', async () => {
    const promise = provider.parseMeal('Zeug');
    (await vi.waitFor(() => http.expectOne(PROXY))).flush(null);
    await expect(promise).rejects.toThrow(AI_ERROR_MESSAGES.unreadable);
  });

  it('mappt 429 auf die Tageslimit-Meldung', async () => {
    const promise = provider.parseMeal('Apfel');
    (await vi.waitFor(() => http.expectOne(PROXY))).flush({ error: 'limit' }, { status: 429, statusText: 'Too Many' });
    await expect(promise).rejects.toThrow(AI_ERROR_MESSAGES.rateLimited);
  });

  it('sendet bei leerem oder zu langem Text nichts', async () => {
    await expect(provider.parseMeal('   ')).rejects.toThrow();
    await expect(provider.parseMeal('x'.repeat(MAX_MEAL_TEXT_CHARS + 1))).rejects.toThrow();
    http.expectNone(() => true);
  });

  it('fragt ohne Zustimmung nach und sendet bei Ablehnung nichts', async () => {
    state.granted = false;
    ensure.mockResolvedValue(false);
    await expect(provider.parseMeal('Apfel')).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(ensure).toHaveBeenCalledTimes(1);
    http.expectNone(() => true);
  });
});
