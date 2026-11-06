import { describe, expect, it } from 'vitest';
import { aiConnection, aiStatusLabel, modelOptions } from './ai-status';

describe('ai-status', () => {
  it('is none without server and key', () => {
    expect(aiConnection({})).toBe('none');
    expect(aiConnection({ proxyUrl: '  ', apiKey: ' ' })).toBe('none');
  });

  it('prefers the server over an own key', () => {
    expect(aiConnection({ proxyUrl: 'https://x', apiKey: 'k' })).toBe('server');
    expect(aiConnection({ apiKey: 'k' })).toBe('ownKey');
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
