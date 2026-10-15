import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ClaudeAiProvider } from './claude-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { AiConfig, UserProfile } from '../models';

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

function anthropicReply(json: string) {
  return { content: [{ type: 'text', text: json }] };
}

function configure(ai: Partial<AiConfig>): void {
  const store = TestBed.inject(SettingsStore);
  store.setAi({ provider: 'claude', endpoint: '', model: '', apiKey: 'sk-test', ...ai });
}

let http: HttpTestingController;
let provider: ClaudeAiProvider;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(ClaudeAiProvider);
});

afterEach(() => http.verify());

describe('ClaudeAiProvider — Modell-Routing (Kostenschutz)', () => {
  it('nutzt das günstige Haiku-Modell für einfache Tasks, wenn kein Modell gesetzt ist', async () => {
    // Arrange
    configure({ model: '' });

    // Act
    const promise = provider.computeTargets(profile);
    const req = http.expectOne('https://api.anthropic.com/v1/messages');

    // Assert
    expect(req.request.body.model).toBe('claude-haiku-4-5-20251001');
    expect(req.request.headers.get('x-api-key')).toBe('sk-test');
    req.flush(anthropicReply(TARGET_JSON));
    await promise;
  });

  it('nutzt Sonnet nur für die Vision-/Etikett-Erkennung', async () => {
    // Arrange
    configure({ model: '' });

    // Act
    const promise = provider.recognizeLabel('deadbeef', 'per100g');
    const req = http.expectOne('https://api.anthropic.com/v1/messages');

    // Assert
    expect(req.request.body.model).toBe('claude-sonnet-4-6');
    req.flush(anthropicReply(LABEL_JSON));
    await promise;
  });

  it('überschreibt das Routing, wenn in den Einstellungen ein Modell gesetzt ist', async () => {
    // Arrange
    configure({ model: 'claude-opus-4-8' });

    // Act
    const promise = provider.computeTargets(profile);
    const req = http.expectOne('https://api.anthropic.com/v1/messages');

    // Assert
    expect(req.request.body.model).toBe('claude-opus-4-8');
    req.flush(anthropicReply(TARGET_JSON));
    await promise;
  });
});

describe('ClaudeAiProvider — Robustheit', () => {
  it('wirft ohne API-Key einen klaren Fehler', async () => {
    // Arrange
    configure({ apiKey: '' });

    // Act / Assert
    await expect(provider.computeTargets(profile)).rejects.toThrow(/API-Key/);
    http.expectNone('https://api.anthropic.com/v1/messages');
  });

  it('klemmt negative Nährwerte aus einer defekten Antwort auf 0', async () => {
    // Arrange
    configure({ model: '' });

    // Act
    const promise = provider.computeTargets(profile);
    const req = http.expectOne('https://api.anthropic.com/v1/messages');
    req.flush(anthropicReply('{"kcal":-500,"proteinG":-5,"carbsG":10,"fatG":3}'));
    const target = await promise;

    // Assert
    expect(target.kcal).toBe(0);
    expect(target.proteinG).toBe(0);
    expect(target.carbsG).toBe(10);
  });
});
