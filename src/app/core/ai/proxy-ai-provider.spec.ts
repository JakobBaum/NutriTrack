import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AI_ERROR_MESSAGES } from './ai-errors';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProxyAiProvider } from './proxy-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { DebugLogService } from '../debug/debug-log.service';

const PROXY = 'https://proxy.test/ai';
const REQ = { restaurant: 'X', kcalBudget: 0 };

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
    await expect(provider.suggestFastfood(REQ)).rejects.toThrow('Keine KI-Proxy-URL konfiguriert.');
  });

  it('sendet { fn, payload } und protokolliert Erfolg', async () => {
    const p = provider.suggestFastfood(REQ);
    const req = http.expectOne(PROXY);
    expect(req.request.body).toEqual({ fn: 'suggestFastfood', payload: REQ });
    req.flush([]);
    expect(await p).toEqual([]);
    expect(log.entries()[0]).toMatchObject({ level: 'success', msg: '✓ suggestFastfood OK' });
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
    const p = provider.suggestFastfood(REQ);
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
      const p = provider.suggestFastfood(REQ);
      http.expectOne(PROXY).flush({ error: 'Gemini 503' }, { status, statusText: 'x' });
      await expect(p).rejects.toThrow(message);
    }
  });
});

describe('ProxyAiProvider Zeitlimit', () => {
  it('meldet nach 30 s eine klare deutsche Meldung', async () => {
    vi.useFakeTimers();
    try {
      const p = provider.suggestFastfood(REQ);
      const assertion = expect(p).rejects.toThrow(AI_ERROR_MESSAGES.timeout);
      http.expectOne(PROXY);
      await vi.advanceTimersByTimeAsync(30001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
