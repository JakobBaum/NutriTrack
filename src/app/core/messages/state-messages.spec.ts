import { describe, expect, it } from 'vitest';
import { STATE_MESSAGES } from './state-messages';

describe('STATE_MESSAGES', () => {
  const texts = Object.values(STATE_MESSAGES);

  it('enthält keine Gedankenstriche und keine Hinweise auf nicht vorhandene Einstellungen', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/ [—-] /);
      expect(text).not.toMatch(/KI-Verbindung|Schlüssel/);
    }
  });

  it('endet jeder Hinweis mit einem Punkt', () => {
    for (const text of texts) expect(text.endsWith('.')).toBe(true);
  });
});
