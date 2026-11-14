import { ADULT_AGE } from '../nutrition/profile-plausibility';

/** Speicherschlüssel (ohne Präfix). Gehört nicht ins Backup, damit ein Import keine Zustimmung mitbringt. */
export const CONSENT_KEY = 'consent';

/** Bei jeder inhaltlichen Änderung des Dialogtexts erhöhen: dann wird neu gefragt. */
export const CONSENT_VERSION = 1;

/** Gespeicherte Zustimmung zu den KI- und Online-Funktionen. */
export interface ConsentRecord {
  readonly version: number;
  /** ISO-Zeitpunkt der Zustimmung; `null` = keine Zustimmung. */
  readonly acceptedAt: string | null;
  readonly isAdultConfirmed: boolean;
}

export const NO_CONSENT: ConsentRecord = { version: CONSENT_VERSION, acceptedAt: null, isAdultConfirmed: false };

/** Prüft einen gespeicherten Wert; alles Kaputte oder Alte gilt als keine Zustimmung. */
export function parseConsent(raw: unknown): ConsentRecord {
  if (typeof raw !== 'object' || raw === null) return NO_CONSENT;
  const r = raw as Record<string, unknown>;
  if (r['version'] !== CONSENT_VERSION || r['isAdultConfirmed'] !== true) return NO_CONSENT;
  const at = r['acceptedAt'];
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return NO_CONSENT;
  return { version: CONSENT_VERSION, acceptedAt: at, isAdultConfirmed: true };
}

export function isConsentGranted(record: ConsentRecord): boolean {
  return record.version === CONSENT_VERSION && record.isAdultConfirmed && record.acceptedAt !== null;
}

/** Neue Zustimmung; `null`, wenn die Volljährigkeit nicht bestätigt wurde. */
export function buildConsent(now: Date, isAdultConfirmed: boolean): ConsentRecord | null {
  if (!isAdultConfirmed) return null;
  return { version: CONSENT_VERSION, acceptedAt: now.toISOString(), isAdultConfirmed: true };
}

/** True nur bei einem bekannten Alter unter 18. Ein fehlendes oder ungültiges Alter gilt nicht als minderjährig. */
export function isUnderAge(age: number | null | undefined): boolean {
  return typeof age === 'number' && Number.isFinite(age) && age > 0 && age < ADULT_AGE;
}

/** Datum der Zustimmung als Lesetext (TT.MM.JJJJ), sonst `null`. */
export function consentDateLabel(iso: string | null): string | null {
  if (iso === null || Number.isNaN(Date.parse(iso))) return null;
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
