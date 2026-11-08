import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProxyAiProvider } from './proxy-ai-provider';
import { environment } from '../../../environments/environment';
import { AI_ERROR_MESSAGES } from './ai-errors';

const PROXY = 'https://proxy.test/ai';

let http: HttpTestingController;
let provider: ProxyAiProvider;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(ProxyAiProvider);
  environment.aiProxyUrl = PROXY;
});

afterEach(() => {
  http.verify();
  environment.aiProxyUrl = '';
});

describe('ProxyAiProvider.ping', () => {
  it('sendet fn "ping" ohne Payload an die Proxy-URL', async () => {
    const p = provider.ping();
    const req = http.expectOne(PROXY);
    expect(req.request.body).toEqual({ fn: 'ping', payload: {} });
    req.flush({});
    await expect(p).resolves.toBeUndefined();
  });

  it('gilt als erreichbar bei „Unbekannte Funktion“ (Worker antwortet, kein KI-Aufruf)', async () => {
    const p = provider.ping();
    http.expectOne(PROXY).flush({ error: 'Unbekannte Funktion: ping' }, { status: 400, statusText: 'Bad Request' });
    await expect(p).resolves.toBeUndefined();
  });

  it('meldet 503 als überlastet, ohne rohen Statustext', async () => {
    const p = provider.ping();
    http.expectOne(PROXY).flush({ error: 'x' }, { status: 503, statusText: 'Service Unavailable' });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.overloaded);
  });

  it('meldet einen Netzwerkfehler als offline', async () => {
    const p = provider.ping();
    http.expectOne(PROXY).error(new ProgressEvent('error'));
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.offline);
  });

  it('meldet 404 (kein Worker unter dieser Adresse) als allgemeinen Fehler', async () => {
    const p = provider.ping();
    http.expectOne(PROXY).flush({ error: 'Nicht gefunden.' }, { status: 404, statusText: 'Not Found' });
    await expect(p).rejects.toThrow(AI_ERROR_MESSAGES.generic);
  });

  it('wirft ohne Proxy-URL', async () => {
    environment.aiProxyUrl = '  ';
    await expect(provider.ping()).rejects.toThrow('Keine KI-Proxy-URL konfiguriert.');
  });
});
