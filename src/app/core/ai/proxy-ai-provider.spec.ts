import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { AI_ERROR_MESSAGES } from './ai-errors';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProxyAiProvider } from './proxy-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { DebugLogService } from '../debug/debug-log.service';
import { UserProfile } from '../models';

const PROXY = 'https://proxy.test/ai';
const profile: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'maintain', updatedAt: '2026-10-13T00:00:00.000Z',
};

let http: HttpTestingController;
let provider: ProxyAiProvider;
let log: DebugLogService;

function setProxy(proxyUrl: string): void {
  TestBed.inject(SettingsStore).setAi({ provider: 'gemini', proxyUrl });
}

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(ProxyAiProvider);
  log = TestBed.inject(DebugLogService);
  setProxy(` ${PROXY} `);
});

afterEach(() => http.verify());

describe('ProxyAiProvider', () => {
  it('wirft ohne Proxy-URL', async () => {
    setProxy('  ');
    await expect(provider.computeTargets(profile)).rejects.toThrow('Keine KI-Proxy-URL konfiguriert.');
  });

  it('sendet { fn, payload } und protokolliert Erfolg', async () => {
    const p = provider.computeTargets(profile);
    const req = http.expectOne(PROXY);
    expect(req.request.body).toEqual({ fn: 'computeTargets', payload: profile });
    req.flush({ kcal: 2000 });
    expect((await p).kcal).toBe(2000);
    expect(log.entries()[0]).toMatchObject({ level: 'success', msg: '✓ computeTargets OK' });
  });

  it('leitet alle Funktionen mit passendem fn weiter', async () => {
    const cases: [Promise<unknown>, string][] = [
      [provider.generateShoppingList({ persons: 1, days: 1, meals: [], recipes: [] }), 'generateShoppingList'],
      [provider.recognizeLabel('b64', 'per100g'), 'recognizeLabel'],
      [provider.suggestFastfood({ restaurant: 'X', kcalBudget: 0 }), 'suggestFastfood'],
    ];
    const reqs = http.match(PROXY);
    expect(reqs.map((r) => r.request.body.fn)).toEqual(cases.map(([, fn]) => fn));
    expect(reqs[1].request.body.payload).toEqual({ imageBase64: 'b64', basis: 'per100g' });
    reqs.forEach((r) => r.flush({}));
    await Promise.all(cases.map(([p]) => p));
  });

  it('normalisiert den Rezept-Import', async () => {
    const p = provider.importRecipe({ url: 'https://x.test' });
    http.expectOne(PROXY).flush('kein objekt');
    const res = await p;
    expect(res.title).toBe('Importiertes Rezept');
    expect(res.sourceUrl).toBe('https://x.test');
  });

  it('meldet Status 0 als Offline-Hinweis', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(PROXY).error(new ProgressEvent('error'), { status: 0 });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.offline);
    expect(log.entries()[0].level).toBe('error');
  });

  it('mappt HTTP-Status auf freundliche Meldungen statt rohem "500: Gemini 503"', async () => {
    const cases: Array<[number, string]> = [
      [503, AI_ERROR_MESSAGES.overloaded],
      [500, AI_ERROR_MESSAGES.overloaded],
      [429, AI_ERROR_MESSAGES.rateLimited],
      [401, AI_ERROR_MESSAGES.unauthorized],
      [403, AI_ERROR_MESSAGES.unauthorized],
      [413, AI_ERROR_MESSAGES.generic],
    ];
    for (const [status, message] of cases) {
      const p = provider.computeTargets(profile);
      http.expectOne(PROXY).flush({ error: 'Gemini 503' }, { status, statusText: 'x' });
      await expect(p).rejects.toThrow(message);
    }
  });
});
