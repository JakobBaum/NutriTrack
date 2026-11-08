import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { defaultAiProxyUrl, effectiveProxyUrl } from './ai-endpoint';
import { resolveAiRoutes } from './ai-route';

const GLOBAL = 'https://global.test/';

describe('ai-endpoint', () => {
  const original = environment.aiProxyUrl;
  afterEach(() => { environment.aiProxyUrl = original; });

  it('nutzt den globalen Standard, wenn keine eigene Adresse gesetzt ist', () => {
    environment.aiProxyUrl = GLOBAL;
    expect(defaultAiProxyUrl()).toBe('https://global.test');
    expect(effectiveProxyUrl({})).toBe('https://global.test');
    expect(effectiveProxyUrl({ proxyUrl: '  ' })).toBe('https://global.test');
  });

  it('bevorzugt die eigene Adresse und entfernt den Schrägstrich', () => {
    environment.aiProxyUrl = GLOBAL;
    expect(effectiveProxyUrl({ proxyUrl: ' https://own.test// ' })).toBe('https://own.test');
  });

  it('liefert den Worker-Weg ohne Einstellungen, eigener Key kommt zuerst', () => {
    environment.aiProxyUrl = GLOBAL;
    expect(resolveAiRoutes({})).toEqual(['proxy']);
    expect(resolveAiRoutes({ provider: 'gemini', apiKey: 'k' })).toEqual(['ownKey', 'proxy']);
  });

  it('ist leer (Mock), wenn gar kein Standard konfiguriert ist', () => {
    environment.aiProxyUrl = '';
    expect(resolveAiRoutes({})).toEqual([]);
  });
});
