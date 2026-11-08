import { describe, expect, it } from 'vitest';
import { aiConnection, aiStatusLabel, modelOptions } from './ai-status';

describe('ai-status', () => {
  it('is none without server and key', () => {
    expect(aiConnection({})).toBe('none');
    expect(aiConnection({ provider: 'gemini', proxyUrl: '  ', apiKey: ' ' })).toBe('none');
    expect(aiStatusLabel('server')).toBe('Globaler KI-Server aktiv');
  });

  it('prefers an own key over the server', () => {
    expect(aiConnection({ provider: 'gemini', proxyUrl: 'https://x', apiKey: 'k' })).toBe('ownKey');
    expect(aiConnection({ provider: 'gemini', proxyUrl: 'https://x' })).toBe('server');
    expect(aiConnection({ provider: 'gemini', apiKey: 'k' })).toBe('ownKey');
  });

  it('labels each state', () => {
    expect(aiStatusLabel('none')).toBe('Nicht verbunden');
    expect(aiStatusLabel('server')).toContain('KI-Server');
    expect(aiStatusLabel('ownKey')).toContain('Schlüssel');
  });

  it('keeps an unknown saved model selectable', () => {
    expect(modelOptions('custom-1').some((m) => m.value === 'custom-1')).toBe(true);
    expect(modelOptions('').length).toBe(modelOptions(undefined).length);
  });
});
