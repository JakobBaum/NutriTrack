import { afterEach, describe, expect, it } from 'vitest';
import { AI_ERROR_MESSAGES, friendlyAiErrorMessage } from './ai-errors';

describe('friendlyAiErrorMessage', () => {
  it('maps 503 and 500 to the overloaded message', () => {
    expect(friendlyAiErrorMessage(503)).toBe(AI_ERROR_MESSAGES.overloaded);
    expect(friendlyAiErrorMessage(500)).toBe(AI_ERROR_MESSAGES.overloaded);
  });
  it('maps 429 to the rate-limit message', () => {
    expect(friendlyAiErrorMessage(429)).toBe(AI_ERROR_MESSAGES.rateLimited);
  });
  it('maps 401 and 403 to the key-invalid message', () => {
    expect(friendlyAiErrorMessage(401)).toBe(AI_ERROR_MESSAGES.unauthorized);
    expect(friendlyAiErrorMessage(403)).toBe(AI_ERROR_MESSAGES.unauthorized);
  });
  it('maps 422 to the unreadable-answer message', () => {
    expect(friendlyAiErrorMessage(422)).toBe(AI_ERROR_MESSAGES.unreadable);
  });
  it('maps 422 beim Link-Import auf den Hinweis, den Rezepttext einzufügen', () => {
    expect(friendlyAiErrorMessage(422, true)).toBe(AI_ERROR_MESSAGES.linkBlocked);
    expect(AI_ERROR_MESSAGES.linkBlocked).toContain('Kopiere den Rezepttext');
  });
  it('lässt andere Status beim Link-Import unverändert', () => {
    expect(friendlyAiErrorMessage(429, true)).toBe(AI_ERROR_MESSAGES.rateLimited);
  });
  it('falls back to the generic message', () => {
    expect(friendlyAiErrorMessage(418)).toBe(AI_ERROR_MESSAGES.generic);
  });
});

describe('friendlyAiErrorMessage bei Status 0', () => {
  const setOnline = (value: boolean): void => {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  };
  afterEach(() => setOnline(true));

  it('meldet den Dienst als nicht erreichbar, wenn das Gerät online ist', () => {
    setOnline(true);
    expect(friendlyAiErrorMessage(0)).toBe(AI_ERROR_MESSAGES.unreachable);
    expect(AI_ERROR_MESSAGES.unreachable).toBe('Der Dienst ist gerade nicht erreichbar. Versuch es später noch einmal.');
  });

  it('behält den Offline-Text, wenn das Gerät wirklich offline ist', () => {
    setOnline(false);
    expect(friendlyAiErrorMessage(0)).toBe(AI_ERROR_MESSAGES.offline);
  });
});
