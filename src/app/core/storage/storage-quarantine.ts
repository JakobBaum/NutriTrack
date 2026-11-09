/**
 * Quarantäne (Rolle 13 F4/F5): beschädigte Rohdaten und verworfene Datensätze werden nicht gelöscht,
 * sondern unter einem eigenen Schlüssel abgelegt. Rein, ohne Browser-Abhängigkeit.
 */

/** Schlüssel-Präfix (ohne App-Präfix) aller Quarantäne-Einträge. Sie gehören nicht ins Backup. */
export const QUARANTINE_PREFIX = 'quarantine.';
/** So viele Quarantäne-Einträge bleiben höchstens erhalten (älteste fallen weg). */
export const MAX_QUARANTINE_ENTRIES = 10;

export type QuarantineReason = 'parse' | 'invalid';

/** Inhalt eines Quarantäne-Eintrags. */
export interface QuarantineRecord {
  readonly key: string;
  readonly reason: QuarantineReason;
  readonly at: string;
  /** Verworfene Datensätze (Grund `invalid`). */
  readonly items?: readonly unknown[];
  /** Unlesbarer Rohtext (Grund `parse`). */
  readonly raw?: string;
}

/** Hinweis an die Oberfläche, dass Daten beim Laden oder Import aussortiert wurden. */
export interface QuarantineNotice {
  readonly key: string;
  readonly count: number;
  /** False, wenn die Sicherung selbst nicht geschrieben werden konnte (Speicher voll). */
  readonly saved: boolean;
}

export const isQuarantineKey = (key: string): boolean => key.startsWith(QUARANTINE_PREFIX);

/** Eindeutiger Schlüssel je Quelle und Zeitpunkt, z. B. `quarantine.diary.1731160000000`. */
export function quarantineKey(source: string, at: number): string {
  return `${QUARANTINE_PREFIX}${source}.${at}`;
}

/** Zeitstempel am Ende des Schlüssels; 0, wenn nicht lesbar. */
function stampOf(key: string): number {
  const n = Number(key.slice(key.lastIndexOf('.') + 1));
  return Number.isFinite(n) ? n : 0;
}

/** Schlüssel, die wegfallen sollen, damit höchstens `max` neueste bleiben. */
export function keysToPrune(keys: readonly string[], max: number = MAX_QUARANTINE_ENTRIES): string[] {
  const sorted = keys.filter(isQuarantineKey).sort((a, b) => stampOf(b) - stampOf(a));
  return sorted.slice(max);
}

/** Baut den Quarantäne-Eintrag. */
export function buildQuarantineRecord(
  key: string,
  reason: QuarantineReason,
  payload: { readonly items?: readonly unknown[]; readonly raw?: string },
  at: Date,
): QuarantineRecord {
  return { key, reason, at: at.toISOString(), ...payload };
}

/** Meldung für Hinweise: "2 beschädigte Einträge (diary) wurden aussortiert und gesichert." */
export function describeNotices(notices: readonly QuarantineNotice[]): string {
  const total = notices.reduce((sum, n) => sum + n.count, 0);
  if (total === 0) return '';
  const subject = total === 1 ? '1 beschädigter Datensatz wurde' : `${total} beschädigte Datensätze wurden`;
  const unsaved = notices.some((n) => !n.saved);
  return `${subject} aussortiert${unsaved ? '' : ' und gesichert'}.`;
}
