import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  NO_CONSENT,
  buildConsent,
  consentDateLabel,
  isConsentGranted,
  isUnderAge,
  parseConsent,
} from './consent.model';

const VALID = { version: CONSENT_VERSION, acceptedAt: '2026-11-14T10:00:00.000Z', isAdultConfirmed: true };

describe('parseConsent', () => {
  it('übernimmt einen gültigen gespeicherten Wert', () => {
    expect(parseConsent(VALID)).toEqual(VALID);
  });

  it.each([null, undefined, 'ja', 42, [], {}])('gilt bei kaputtem Wert %j als keine Zustimmung', (raw) => {
    expect(parseConsent(raw)).toEqual(NO_CONSENT);
  });

  it('gilt bei alter Versionsnummer als keine Zustimmung', () => {
    expect(parseConsent({ ...VALID, version: CONSENT_VERSION - 1 })).toEqual(NO_CONSENT);
  });

  it('gilt ohne bestätigte Volljährigkeit als keine Zustimmung', () => {
    expect(parseConsent({ ...VALID, isAdultConfirmed: false })).toEqual(NO_CONSENT);
  });

  it('gilt bei ungültigem Datum als keine Zustimmung', () => {
    expect(parseConsent({ ...VALID, acceptedAt: 'gestern' })).toEqual(NO_CONSENT);
  });
});

describe('isConsentGranted', () => {
  it('ist nur mit Datum, Version und Altersbestätigung wahr', () => {
    expect(isConsentGranted(VALID)).toBe(true);
    expect(isConsentGranted(NO_CONSENT)).toBe(false);
  });
});

describe('buildConsent', () => {
  it('baut die Zustimmung mit aktueller Version und Zeit', () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    expect(buildConsent(now, true)).toEqual(VALID);
  });

  it('liefert null ohne bestätigte Volljährigkeit', () => {
    expect(buildConsent(new Date(), false)).toBeNull();
  });
});

describe('isUnderAge', () => {
  it.each([[17, true], [1, true], [18, false], [40, false]])('Alter %i unter 18: %s', (age, expected) => {
    expect(isUnderAge(age)).toBe(expected);
  });

  it.each([[0], [-3], [NaN], [undefined], [null]])('unbekanntes Alter %s gilt nicht als minderjährig', (age) => {
    expect(isUnderAge(age as number | undefined | null)).toBe(false);
  });
});

describe('consentDateLabel', () => {
  it('formatiert das Datum, sonst null', () => {
    expect(consentDateLabel(VALID.acceptedAt)).toMatch(/^\d{2}\.\d{2}\.2026/);
    expect(consentDateLabel(null)).toBeNull();
  });
});
