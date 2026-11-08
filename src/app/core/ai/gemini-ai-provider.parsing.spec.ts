import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GeminiAiProvider } from './gemini-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { AiConfig, UserProfile } from '../models';

const URL_FLASH = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

const profile: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'maintain', updatedAt: '2026-10-13T00:00:00.000Z',
};

const reply = (...texts: string[]) => ({ candidates: [{ content: { parts: texts.map((text) => ({ text })) } }] });

let http: HttpTestingController;
let provider: GeminiAiProvider;

function configure(ai: Partial<AiConfig> = {}): void {
  TestBed.inject(SettingsStore).setAi({ provider: 'gemini', endpoint: '', model: '', apiKey: 'test-key', ...ai });
}

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(GeminiAiProvider);
  configure();
});

afterEach(() => {
  http.verify();
  vi.useRealTimers();
});

// Defensives Parsen von (fehlerhaften) Modellantworten.
describe('GeminiAiProvider — JSON-Extraktion', () => {
  it('entfernt ```json-Codezäune', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(reply('```json\n{"kcal":1800}\n```'));
    expect((await p).kcal).toBe(1800);
  });

  it('findet JSON mitten in Fließtext', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(reply('Hier ist das Ergebnis: {"kcal":2100,"proteinG":"120"} Viel Erfolg!'));
    const t = await p;
    expect(t.kcal).toBe(2100);
    expect(t.proteinG).toBe(120); // numerischer String wird akzeptiert
  });

  it('setzt fehlende, nicht-numerische und Komma-Werte auf 0', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(reply('{"kcal":"viel","carbsG":"12,5","fatG":null}'));
    const t = await p;
    expect(t).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 });
  });

  it('wirft bei ungültigem JSON eine klare Meldung', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(reply('{kaputt: ]'));
    await expect(p).rejects.toThrow('KI-Antwort war kein gültiges JSON.');
  });

  it('wirft bei leerer Antwort ohne candidates', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush({});
    await expect(p).rejects.toThrow(/kein gültiges JSON/);
  });

  it('fügt mehrere Text-Parts zusammen', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(reply('{"kcal":', '1500}'));
    expect((await p).kcal).toBe(1500);
  });
});

describe('GeminiAiProvider — Mapping je Funktion', () => {
  it('mappt die Einkaufsliste und toleriert falsche Typen', async () => {
    const p = provider.generateShoppingList({ persons: 1, days: 1, meals: ['lunch'], recipes: [] });
    http.expectOne(URL_FLASH).flush(reply(JSON.stringify({
      items: [{ name: 'Reis', amount: '500', estPrice: -2 }, {}],
      suggestedDishes: [1, 'Curry'],
      estTotal: 'x',
    })));
    const res = await p;
    expect(res.items[0]).toMatchObject({ name: 'Reis', amount: 500, unit: 'g', checked: false, estPrice: 0, category: 'Trockenware/Nudeln/Reis' });
    expect(res.items[1].category).toBe('Sonstiges');
    expect(res.items[1].name).toBe('');
    expect(res.suggestedDishes).toEqual(['1', 'Curry']);
    expect(res.estTotal).toBe(0);
    expect(res.note).toBeUndefined();
  });

  it('liefert leere Listen, wenn items/suggestedDishes keine Arrays sind', async () => {
    const p = provider.generateShoppingList({ persons: 1, days: 1, meals: ['lunch'], recipes: [] });
    http.expectOne(URL_FLASH).flush(reply('{"items":"nein","suggestedDishes":null,"estTotal":12.5,"note":"ok"}'));
    const res = await p;
    expect(res.items).toEqual([]);
    expect(res.suggestedDishes).toEqual([]);
    expect(res.estTotal).toBe(12.5);
    expect(res.note).toBe('ok');
  });

  it('nutzt beim Etikett „Produkt" als Namen und übernimmt die Basis', async () => {
    const p = provider.recognizeLabel('abc', 'perPortion');
    http.expectOne(URL_FLASH).flush(reply('{"kcal":120}'));
    const res = await p;
    expect(res.name).toBe('Produkt');
    expect(res.facts.basis).toBe('perPortion');
    expect(res.facts.kcal).toBe(120);
  });

  it('akzeptiert Fastfood als Array oder {items}', async () => {
    const req = { restaurant: 'Burger', kcalBudget: 800 };
    const p1 = provider.suggestFastfood(req);
    http.expectOne(URL_FLASH).flush(reply('[{"itemName":"Wrap","kcal":300,"estPrice":null}]'));
    const r1 = await p1;
    expect(r1[0].restaurant).toBe('Burger');
    expect(r1[0].estPrice).toBeUndefined();
    expect(r1[0].facts.basis).toBe('perPortion');

    const p2 = provider.suggestFastfood(req);
    http.expectOne(URL_FLASH).flush(reply('{"items":[{"restaurant":"X","itemName":"Salat","estPrice":"4.5"}]}'));
    const r2 = await p2;
    expect(r2[0].restaurant).toBe('X');
    expect(r2[0].estPrice).toBe(4.5);
  });

  it('liefert [] bei Fastfood-Objekt ohne items', async () => {
    const p = provider.suggestFastfood({ restaurant: 'X', kcalBudget: 0 });
    http.expectOne(URL_FLASH).flush(reply('{"foo":1}'));
    expect(await p).toEqual([]);
  });

  it('sendet beim Rezept-Foto inlineData und normalisiert die Antwort', async () => {
    const p = provider.importRecipe({ imageBase64: 'img' });
    const req = http.expectOne(URL_FLASH);
    expect(req.request.body.contents[0].parts[0].inlineData.data).toBe('img');
    req.flush(reply('{"title":"","servings":0,"ingredients":[{"name":"Mehl","amount":200,"unit":"g"}]}'));
    const res = await p;
    expect(res.title).toBe('Importiertes Rezept');
    expect(res.servings).toBe(2);
    expect(res.ingredients[0].name).toBe('Mehl');
  });

  it('fragt bei leerem Text die URL an', async () => {
    const p = provider.importRecipe({ text: '   ', url: 'https://x.test/r' });
    const req = http.expectOne(URL_FLASH);
    expect(req.request.body.contents[0].parts[0].text).toContain('https://x.test/r');
    req.flush(reply('{"title":"T"}'));
    expect((await p).sourceUrl).toBe('https://x.test/r');
  });

  it('nutzt einen eigenen Endpoint aus den Einstellungen', async () => {
    configure({ endpoint: ' https://proxy.test/models ' });
    const p = provider.computeTargets(profile);
    http.expectOne('https://proxy.test/models/gemini-3.6-flash:generateContent').flush(reply('{"kcal":1}'));
    expect((await p).kcal).toBe(1);
  });
});

describe('GeminiAiProvider — Retry', () => {
  it('wiederholt bei 503 und liefert dann das Ergebnis', async () => {
    vi.useFakeTimers();
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(null, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(600);
    http.expectOne(URL_FLASH).flush(reply('{"kcal":1900}'));
    expect((await p).kcal).toBe(1900);
  });

  it('meldet nach 3× 503 „überlastet"', async () => {
    vi.useFakeTimers();
    const p = provider.computeTargets(profile);
    const assertion = expect(p).rejects.toThrow(/gerade überlastet/);
    http.expectOne(URL_FLASH).flush(null, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(600);
    http.expectOne(URL_FLASH).flush(null, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(1200);
    http.expectOne(URL_FLASH).flush(null, { status: 503, statusText: 'Unavailable' });
    await assertion;
  });

  it('meldet 401 als ungültigen Schlüssel', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(p).rejects.toThrow(/Schlüssel/);
  });

  it('wiederholt bei 400 nicht und reicht den Fehler weiter', async () => {
    const p = provider.computeTargets(profile);
    http.expectOne(URL_FLASH).flush({ error: 'bad' }, { status: 400, statusText: 'Bad Request' });
    await expect(p).rejects.toThrow(/fehlgeschlagen/);
    http.expectNone(URL_FLASH);
  });
});

describe('GeminiAiProvider — Einkaufs-Kategorien', () => {
  it('übernimmt gültige Kategorien und fällt sonst auf den Kategorisierer zurück', async () => {
    const p = provider.generateShoppingList({ persons: 1, days: 1, meals: ['lunch'], recipes: [] });
    http.expectOne(URL_FLASH).flush(reply(JSON.stringify({
      items: [
        { name: 'Milch', amount: 1, unit: 'l', category: 'Kühlregal/Milchprodukte' },
        { name: 'Lachs', amount: 200, unit: 'g', category: 'Haushalt' },
        { name: 'Tomaten', amount: 3, unit: 'Stk' },
      ],
    })));
    const res = await p;
    expect(res.items.map((i) => i.category)).toEqual([
      'Kühlregal/Milchprodukte',
      'Fleisch & Fisch',
      'Obst & Gemüse',
    ]);
  });
});
