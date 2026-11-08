import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GeminiAiProvider } from './gemini-ai-provider';
import { SettingsStore } from '../state/settings.store';
import { AI_ERROR_MESSAGES } from './ai-errors';

const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1';

let http: HttpTestingController;
let provider: GeminiAiProvider;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(GeminiAiProvider);
  TestBed.inject(SettingsStore).setAi({ provider: 'gemini', endpoint: '', model: '', apiKey: 'test-key' });
});

afterEach(() => http.verify());

describe('GeminiAiProvider.ping', () => {
  it('prüft Key über die Modellliste ohne Modellaufruf', async () => {
    const p = provider.ping();
    const req = http.expectOne(MODELS_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('x-goog-api-key')).toBe('test-key');
    req.flush({ models: [] });
    await expect(p).resolves.toBeUndefined();
  });

  it('meldet einen abgelehnten Schlüssel (400/403) verständlich', async () => {
    const p = provider.ping();
    http.expectOne(MODELS_URL).flush({}, { status: 400, statusText: 'Bad Request' });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.unauthorized);
  });

  it('wirft ohne Key ohne Netzwerkaufruf', async () => {
    TestBed.inject(SettingsStore).setAi({ provider: 'gemini', apiKey: '' });
    await expect(provider.ping()).rejects.toThrow('Kein Gemini-API-Key');
  });
});
