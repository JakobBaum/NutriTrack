import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { GeminiAiProvider } from './gemini-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { AiConfig, UserProfile } from '../models';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const url = (model: string) => `${BASE}/${model}:generateContent`;

const profile: UserProfile = {
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'lose',
  rateKgPerWeek: 0.5,
  updatedAt: '2026-10-13T00:00:00.000Z',
};

const TARGET_JSON =
  '{"kcal":2000,"proteinG":150,"carbsG":200,"fatG":60,"fiberG":30,"sugarG":40}';
const LABEL_JSON =
  '{"name":"Müsli","kcal":350,"proteinG":10,"carbsG":60,"fatG":6,"fiberG":8,"sugarG":15}';

function geminiReply(json: string) {
  return { candidates: [{ content: { parts: [{ text: json }] } }] };
}

function configure(ai: Partial<AiConfig>): void {
  const store = TestBed.inject(SettingsStore);
  store.setAi({ provider: 'gemini', endpoint: '', model: '', apiKey: 'test-key', ...ai });
}

let http: HttpTestingController;
let provider: GeminiAiProvider;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(GeminiAiProvider);
});

afterEach(() => http.verify());

describe('GeminiAiProvider — Modell-Routing', () => {
  it('nutzt gemini-3.8-flash als Standardmodell, wenn kein Modell gesetzt ist', async () => {
    // Arrange
    configure({ model: '' });

    // Act
    const promise = provider.computeTargets(profile);
    const req = http.expectOne(url('gemini-3.8-flash'));

    // Assert
    expect(req.request.headers.get('x-goog-api-key')).toBe('test-key');
    req.flush(geminiReply(TARGET_JSON));
    await promise;
  });

  it('nutzt dasselbe (multimodale) Modell für die Vision-/Etikett-Erkennung', async () => {
    // Arrange
    configure({ model: '' });

    // Act
    const promise = provider.recognizeLabel('deadbeef', 'per100g');
    const req = http.expectOne(url('gemini-3.8-flash'));

    // Assert
    expect(req.request.body.contents[0].parts[0].inline_data.data).toBe('deadbeef');
    req.flush(geminiReply(LABEL_JSON));
    await promise;
  });

  it('überschreibt das Modell, wenn in den Einstellungen eines gesetzt ist', async () => {
    // Arrange
    configure({ model: 'gemini-3.8-pro' });

    // Act
    const promise = provider.computeTargets(profile);
    const req = http.expectOne(url('gemini-3.8-pro'));

    // Assert
    expect(req.request.body.generationConfig.responseMimeType).toBe('application/json');
    req.flush(geminiReply(TARGET_JSON));
    await promise;
  });
});

describe('GeminiAiProvider — Robustheit', () => {
  it('wirft ohne API-Key einen klaren Fehler', async () => {
    // Arrange
    configure({ apiKey: '' });

    // Act / Assert
    await expect(provider.computeTargets(profile)).rejects.toThrow(/API-Key/);
    http.expectNone(url('gemini-3.8-flash'));
  });

  it('klemmt negative Nährwerte aus einer defekten Antwort auf 0', async () => {
    // Arrange
    configure({ model: '' });

    // Act
    const promise = provider.computeTargets(profile);
    const req = http.expectOne(url('gemini-3.8-flash'));
    req.flush(geminiReply('{"kcal":-500,"proteinG":-5,"carbsG":10,"fatG":3}'));
    const target = await promise;

    // Assert
    expect(target.kcal).toBe(0);
    expect(target.proteinG).toBe(0);
    expect(target.carbsG).toBe(10);
  });
});
