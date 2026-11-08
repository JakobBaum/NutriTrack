import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProviderToken } from '@angular/core';
import { AiService, NO_AI_MESSAGE } from './ai.service';
import { AiProvider } from './ai-provider';
import { MockAiProvider } from './mock-ai-provider';
import { ProxyAiProvider } from './proxy-ai-provider';
import { AI_ERROR_MESSAGES } from './ai-errors';
import { environment } from '../../../environments/environment';

const FACTS = { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 };
const PROXY_URL = 'https://p.test';

let svc: AiService;

/** Ersetzt alle KI-Methoden eines Anbieters durch Spies und liefert sie. */
function spyAll(token: ProviderToken<AiProvider>) {
  const p = TestBed.inject(token);
  return {
    generateShoppingList: vi.spyOn(p, 'generateShoppingList').mockResolvedValue({ items: [], suggestedDishes: [], estTotal: 0 }),
    recognizeLabel: vi.spyOn(p, 'recognizeLabel').mockResolvedValue({ name: 'n', facts: { ...FACTS, basis: 'per100g' } }),
    suggestFastfood: vi.spyOn(p, 'suggestFastfood').mockResolvedValue([]),
    importRecipe: vi.spyOn(p, 'importRecipe').mockResolvedValue({ title: 't', servings: 1, ingredients: [], steps: [] }),
  };
}

beforeEach(() => {
  localStorage.clear();
  environment.aiProxyUrl = '';
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  svc = TestBed.inject(AiService);
});

afterEach(() => {
  environment.aiProxyUrl = '';
});

describe('AiService — Routing (nur globaler Worker)', () => {
  it('nutzt ohne globale Server-Adresse den Mock', async () => {
    const mock = spyAll(MockAiProvider);
    expect(svc.isLive()).toBe(false);
    await svc.suggestFastfood({ restaurant: 'X', kcalBudget: 0 });
    expect(mock.suggestFastfood).toHaveBeenCalledTimes(1);
  });

  it('ignoriert einen alten, lokal gespeicherten eigenen Key', () => {
    localStorage.setItem('nutritrack:ai-config', JSON.stringify({ provider: 'gemini', apiKey: 'key', proxyUrl: 'https://alt.test' }));
    expect(svc.isLive()).toBe(false);
  });

  it('nutzt mit globaler Server-Adresse den Worker für alle Funktionen', async () => {
    environment.aiProxyUrl = PROXY_URL;
    const proxy = spyAll(ProxyAiProvider);
    const mock = spyAll(MockAiProvider);
    expect(svc.isLive()).toBe(true);
    await svc.generateShoppingList({ persons: 1, days: 1, meals: [], recipes: [] });
    await svc.recognizeLabel('b64', 'per100g');
    await svc.suggestFastfood({ restaurant: 'X', kcalBudget: 0 });
    await svc.importRecipe({ text: 'x' });
    Object.values(proxy).forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    Object.values(mock).forEach((s) => expect(s).not.toHaveBeenCalled());
  });

  it('reicht Worker-Fehler an den Aufrufer durch', async () => {
    environment.aiProxyUrl = PROXY_URL;
    spyAll(ProxyAiProvider).importRecipe.mockRejectedValue(new Error(AI_ERROR_MESSAGES.offline));
    await expect(svc.importRecipe({ text: 'x' })).rejects.toThrow(AI_ERROR_MESSAGES.offline);
  });
});

describe('AiService — testConnection', () => {
  it('meldet „nicht konfiguriert“ ohne globale Adresse', async () => {
    const result = await svc.testConnection();
    expect(result).toEqual({ ok: false, message: NO_AI_MESSAGE });
  });

  it('meldet Erfolg, wenn der Worker antwortet', async () => {
    environment.aiProxyUrl = PROXY_URL;
    vi.spyOn(TestBed.inject(ProxyAiProvider), 'ping').mockResolvedValue();
    const result = await svc.testConnection();
    expect(result.ok).toBe(true);
  });

  it('gibt die Fehlermeldung zurück, wenn der Worker nicht erreichbar ist', async () => {
    environment.aiProxyUrl = PROXY_URL;
    vi.spyOn(TestBed.inject(ProxyAiProvider), 'ping').mockRejectedValue(new Error(AI_ERROR_MESSAGES.offline));
    const result = await svc.testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain(AI_ERROR_MESSAGES.offline);
  });
});
