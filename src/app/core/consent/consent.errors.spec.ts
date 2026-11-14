import { describe, expect, it } from 'vitest';
import { ConsentRequiredError, isConsentRequiredError } from './consent.errors';

describe('ConsentRequiredError', () => {
  it('trägt die nutzerfreundliche Meldung mit Verweis auf das Profil', () => {
    const err = new ConsentRequiredError();
    expect(err.message).toBe('Dafür brauchst du die Zustimmung zu den Online-Funktionen. Du findest sie unter Profil.');
    expect(isConsentRequiredError(err)).toBe(true);
  });

  it('erkennt fremde Fehler nicht', () => {
    expect(isConsentRequiredError(new Error('x'))).toBe(false);
    expect(isConsentRequiredError(null)).toBe(false);
  });
});
