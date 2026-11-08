import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProviderToken } from '@angular/core';
import { AiService } from './ai.service';
import { AiProvider } from './ai-provider';
import { MockAiProvider } from './mock-ai-provider';
import { GeminiAiProvider } from './gemini-ai-provider';
import { ProxyAiProvider } from './proxy-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { DebugLogService } from '../debug/debug-log.service';
import { AiConfig, UserProfile } from '../models';
import { AI_ERROR_MESSAGES } from './ai-errors';

const profile: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'maintain', updatedAt: '2026-10-13T00:00:00.000Z',
};
const TARGET = { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 };
const PROXY_URL = 'https://p.test';

let svc: AiService;

function configure(ai: AiConfig): void {
  TestBed.inject(SettingsStore).setAi(ai);
}

/** Ersetzt alle KI-Methoden eines Anbieters durch Spies und liefert sie. */
function spyAll(token: ProviderToken<AiProvider>) {
  const p = TestBed.inject(token);
  return {
    computeTargets: vi.spyOn(p, 'computeTargets').mockResolvedValue(TARGET),
    generateShoppingList: vi.spyOn(p, 'generateShoppingList').mockResolvedValue({ items: [], suggestedDishes: [], estTotal: 0 }),
    recognizeLabel: vi.spyOn(p, 'recognizeLabel').mockResolvedValue({ name: 'n', facts: { ...TARGET, basis: 'per100g' } }),
    suggestFastfood: vi.spyOn(p, 'suggestFastfood').mockResolvedValue([]),
    importRecipe: vi.spyOn(p, 'importRecipe').mockResolvedValue({ title: 't', servings: 1, ingredients: [], steps: [] }),
  };
}

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  svc = TestBed.inject(AiService);
});

describe('AiService — Routing', () => {
  it('nutzt ohne Key/Proxy den Mock', async () => {
    const mock = spyAll(MockAiProvider);
    expect(svc.isLive()).toBe(false);
    await svc.computeTargets(profile);
    expect(mock.computeTargets).toHaveBeenCalledWith(profile);
  });

  it('ignoriert einen Key aus Leerzeichen oder bei anderem Anbieter', () => {
    configure({ provider: 'gemini', apiKey: '   ' });
    expect(svc.isLive()).toBe(false);
    configure({ provider: 'mock', apiKey: 'key' });
    expect(svc.isLive()).toBe(false);
  });

  it('nutzt mit eigenem Key Gemini für alle Funktionen', async () => {
    configure({ provider: 'gemini', apiKey: 'key' });
    const gemini = spyAll(GeminiAiProvider);
    expect(svc.isLive()).toBe(true);
    await svc.computeTargets(profile);
    await svc.generateShoppingList({ persons: 1, days: 1, meals: [], recipes: [] });
    await svc.recognizeLabel('b64', 'per100g');
    await svc.suggestFastfood({ restaurant: 'X', kcalBudget: 0 });
    await svc.importRecipe({ text: 'x' });
    Object.values(gemini).forEach((s) => expect(s).toHaveBeenCalledTimes(1));
  });

  it('nutzt nur den KI-Server, wenn kein eigener Key gesetzt ist', async () => {
    configure({ provider: 'gemini', apiKey: '', proxyUrl: PROXY_URL });
    const proxy = spyAll(ProxyAiProvider);
    const gemini = spyAll(GeminiAiProvider);
    await svc.importRecipe({ text: 'x' });
    expect(proxy.importRecipe).toHaveBeenCalledTimes(1);
    expect(gemini.importRecipe).not.toHaveBeenCalled();
  });

  it('nutzt bei eigenem Key und KI-Server zuerst Gemini direkt', async () => {
    configure({ provider: 'gemini', apiKey: 'key', proxyUrl: PROXY_URL });
    const proxy = spyAll(ProxyAiProvider);
    const gemini = spyAll(GeminiAiProvider);
    await svc.importRecipe({ text: 'x' });
    expect(gemini.importRecipe).toHaveBeenCalledTimes(1);
    expect(proxy.importRecipe).not.toHaveBeenCalled();
  });

  it('weicht bei Fehlschlag von Gemini auf den KI-Server aus und protokolliert es', async () => {
    configure({ provider: 'gemini', apiKey: 'key', proxyUrl: PROXY_URL });
    spyAll(GeminiAiProvider).importRecipe.mockRejectedValue(new Error(AI_ERROR_MESSAGES.overloaded));
    const proxy = spyAll(ProxyAiProvider);
    const log = TestBed.inject(DebugLogService);
    await expect(svc.importRecipe({ text: 'x' })).resolves.toMatchObject({ title: 't' });
    expect(proxy.importRecipe).toHaveBeenCalledTimes(1);
    expect(log.entries().some((e) => e.msg.includes('weiche aus'))).toBe(true);
  });

  it('reicht den Fehler durch, wenn es nur einen Weg gibt (kein Fallback)', async () => {
    configure({ provider: 'gemini', apiKey: 'key' });
    spyAll(GeminiAiProvider).suggestFastfood.mockRejectedValue(new Error(AI_ERROR_MESSAGES.unauthorized));
    await expect(svc.suggestFastfood({ restaurant: 'X', kcalBudget: 0 })).rejects.toThrow(AI_ERROR_MESSAGES.unauthorized);
  });

  it('wirft den Fehler des primären Weges, wenn beide Wege scheitern', async () => {
    configure({ provider: 'gemini', apiKey: 'key', proxyUrl: PROXY_URL });
    spyAll(GeminiAiProvider).importRecipe.mockRejectedValue(new Error(AI_ERROR_MESSAGES.unauthorized));
    spyAll(ProxyAiProvider).importRecipe.mockRejectedValue(new Error(AI_ERROR_MESSAGES.offline));
    await expect(svc.importRecipe({ text: 'x' })).rejects.toThrow(AI_ERROR_MESSAGES.unauthorized);
  });
});

describe('AiService — testConnection', () => {
  it('meldet „nicht verbunden“ ohne Weg', async () => {
    const result = await svc.testConnection();
    expect(result).toMatchObject({ route: 'none', ok: false });
  });

  it('prüft bei eigenem Key Gemini und meldet Erfolg', async () => {
    configure({ provider: 'gemini', apiKey: 'key', proxyUrl: PROXY_URL });
    const gemini = TestBed.inject(GeminiAiProvider);
    const ping = vi.spyOn(gemini, 'ping').mockResolvedValue();
    const proxy = TestBed.inject(ProxyAiProvider);
    const proxyPing = vi.spyOn(proxy, 'ping').mockResolvedValue();
    const result = await svc.testConnection();
    expect(ping).toHaveBeenCalledTimes(1);
    expect(proxyPing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ route: 'ownKey', ok: true });
  });

  it('prüft ohne eigenen Key den KI-Server und gibt die Fehlermeldung zurück', async () => {
    configure({ provider: 'gemini', apiKey: '', proxyUrl: PROXY_URL });
    vi.spyOn(TestBed.inject(ProxyAiProvider), 'ping').mockRejectedValue(new Error(AI_ERROR_MESSAGES.offline));
    const result = await svc.testConnection();
    expect(result.route).toBe('proxy');
    expect(result.ok).toBe(false);
    expect(result.message).toContain(AI_ERROR_MESSAGES.offline);
    expect(result.message).not.toMatch(/\d{3}:/);
  });
});
