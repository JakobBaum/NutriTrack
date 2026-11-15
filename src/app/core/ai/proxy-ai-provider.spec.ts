import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AI_ERROR_MESSAGES } from './ai-errors';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProxyAiProvider } from './proxy-ai-provider';
import { environment } from '../../../environments/environment';
import { ConsentStore } from '../consent/consent.store';
import { DebugLogService } from '../debug/debug-log.service';

const PROXY = 'https://proxy.test/ai';
const REQ = { restaurant: 'X', kcalBudget: 0 };

let http: HttpTestingController;
let provider: ProxyAiProvider;
let log: DebugLogService;

function setProxy(proxyUrl: string): void {
  environment.aiProxyUrl = proxyUrl;
}

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(ProxyAiProvider);
  TestBed.inject(ConsentStore).grant(new Date(), true);
  log = TestBed.inject(DebugLogService);
  setProxy(` ${PROXY} `);
});

afterEach(() => http.verify());

const GOOD = {
  restaurant: 'KFC', itemName: 'Wrap', rationale: 'ok', estPrice: 4,
  facts: { kcal: 440, proteinG: 25, carbsG: 34, fatG: 23, basis: 'perPortion' },
};

describe('ProxyAiProvider — suggestFastfood prueft die Antwort', () => {
  it('filtert ungueltige Eintraege heraus', async () => {
    const p = provider.suggestFastfood(REQ);
    http.expectOne(PROXY).flush([GOOD, { ...GOOD, itemName: '' }, { ...GOOD, facts: { ...GOOD.facts, kcal: 5 } }]);
    expect((await p).map((s) => s.itemName)).toEqual(['Wrap']);
  });

  it('wirft eine verstaendliche Meldung, wenn kein Eintrag brauchbar ist', async () => {
    const p = provider.suggestFastfood(REQ);
    http.expectOne(PROXY).flush([{ ...GOOD, itemName: '' }]);
    await expect(p).rejects.toThrow(/unbrauchbar/);
  });

  it('wirft bei einer Antwort, die kein Array ist', async () => {
    const p = provider.suggestFastfood(REQ);
    http.expectOne(PROXY).flush({ error: 'x' });
    await expect(p).rejects.toThrow(/unbrauchbar/);
  });
});

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
    const LABEL_OK = { name: 'X', facts: { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, basis: 'per100g' } };
    const answers: Record<string, unknown> = { suggestFastfood: [], recognizeLabel: LABEL_OK };
    reqs.forEach((r) => r.flush(answers[r.request.body.fn] ?? {}));
    await Promise.all(cases.map(([p]) => p));
  });

  it('normalisiert den Rezept-Import', async () => {
    const p = provider.importRecipe({ url: 'https://x.test' });
    http.expectOne(PROXY).flush('kein objekt');
    const res = await p;
    expect(res.title).toBe('Importiertes Rezept');
    expect(res.sourceUrl).toBe('https://x.test');
  });

  it('meldet Status 0 bei vorhandenem Netz als Dienst nicht erreichbar', async () => {
    const p = provider.suggestFastfood(REQ);
    http.expectOne(PROXY).error(new ProgressEvent('error'), { status: 0 });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.unreachable);
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

describe('ProxyAiProvider Link-Import 422', () => {
  it('zeigt beim Link-Import den Hinweis zum Einfügen des Rezepttexts', async () => {
    const p = provider.importRecipe({ url: 'https://www.tiktok.com/x' });
    http.expectOne(PROXY).flush({ error: 'gesperrt' }, { status: 422, statusText: 'x' });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.linkBlocked);
  });

  it('behält bei einem unlesbaren Rezeptfoto den bisherigen Text', async () => {
    const p = provider.importRecipe({ imageBase64: 'abc' });
    http.expectOne(PROXY).flush({ error: 'x' }, { status: 422, statusText: 'x' });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.unreadable);
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

describe('ProxyAiProvider Einkaufsliste', () => {
  it('sendet nur die Titel der Rezepte an den Worker', async () => {
    const recipe = { id: 'r1', title: 'Pasta', servings: 2, ingredients: [{ name: 'Mehl' }], steps: ['Kochen'] };
    const p = provider.generateShoppingList({ persons: 2, days: 1, meals: ['dinner'], recipes: [recipe as never] });
    const req = http.expectOne(PROXY);
    expect(req.request.body.payload.recipes).toEqual([{ title: 'Pasta' }]);
    req.flush({ items: [], suggestedDishes: [], estTotal: 0 });
    await p;
  });
});

describe('ProxyAiProvider: Etikett und Einkaufsliste werden geprueft', () => {
  const LABEL = { name: 'Muesli', facts: { kcal: 380, proteinG: 8, carbsG: 60, fatG: 10, basis: 'per100g' } };
  const SHOP_REQ = { persons: 1, days: 1, meals: ['dinner' as const], recipes: [] };

  it('uebernimmt ein plausibles Etikett', async () => {
    const p = provider.recognizeLabel('abc', 'per100g');
    http.expectOne(PROXY).flush(LABEL);
    expect((await p).facts.kcal).toBe(380);
  });

  it('wirft eine verstaendliche Meldung bei unplausiblen Etikett-Werten', async () => {
    const p = provider.recognizeLabel('abc', 'per100g');
    http.expectOne(PROXY).flush({ ...LABEL, facts: { ...LABEL.facts, kcal: 9000 } });
    await expect(p).rejects.toThrow(/Etikett/);
  });

  it('bereinigt die Einkaufsliste', async () => {
    const ok = provider.generateShoppingList(SHOP_REQ);
    http.expectOne(PROXY).flush({
      items: [{ name: 'Reis', amount: 500, unit: 'g', estPrice: 1, evil: 1 }, { name: '', amount: 1, unit: 'g' }],
      suggestedDishes: ['Reispfanne'], estTotal: 1,
    });
    expect((await ok).items).toEqual([{ name: 'Reis', amount: 500, unit: 'g', checked: false, estPrice: 1 }]);
  });

  it('wirft bei einer Einkaufsliste ohne brauchbare Position', async () => {
    const bad = provider.generateShoppingList(SHOP_REQ);
    http.expectOne(PROXY).flush({ items: [{ name: '', amount: -1, unit: 'g' }] });
    await expect(bad).rejects.toThrow(/Einkaufsliste/);
  });
});
