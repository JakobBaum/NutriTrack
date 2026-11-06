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
import { AiConfig, UserProfile } from '../models';

const profile: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'maintain', updatedAt: '2026-10-13T00:00:00.000Z',
};
const TARGET = { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 };

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

  it('bevorzugt den Proxy vor dem eigenen Key', async () => {
    configure({ provider: 'gemini', apiKey: 'key', proxyUrl: 'https://p.test' });
    const proxy = spyAll(ProxyAiProvider);
    const gemini = spyAll(GeminiAiProvider);
    await svc.importRecipe({ text: 'x' });
    expect(proxy.importRecipe).toHaveBeenCalled();
    expect(gemini.importRecipe).not.toHaveBeenCalled();
  });
});
