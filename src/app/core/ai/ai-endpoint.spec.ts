import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { defaultAiProxyUrl } from './ai-endpoint';

afterEach(() => {
  environment.aiProxyUrl = '';
});

describe('defaultAiProxyUrl', () => {
  it('liefert die Umgebungs-Adresse ohne Leerzeichen und Schrägstrich', () => {
    environment.aiProxyUrl = ' https://w.test// ';
    expect(defaultAiProxyUrl()).toBe('https://w.test');
  });

  it('liefert leer, wenn kein globaler Server konfiguriert ist', () => {
    environment.aiProxyUrl = '';
    expect(defaultAiProxyUrl()).toBe('');
  });
});
