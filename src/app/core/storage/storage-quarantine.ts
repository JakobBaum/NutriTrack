/**
 * Quarantäne (Rolle 13 F4/F5): beschädigte Rohdaten und verworfene Datensätze werden nicht gelöscht,
 * sondern unter einem eigenen Schlüssel abgelegt. Rein, ohne Browser-Abhängigkeit.
 */

/** Schlüssel-Präfix (ohne App-Präfix) aller Quarantäne-Einträge. Sie gehören nicht ins Backup. */
export const QUARANTINE_PREFIX = 'quarantine.';
/** So viele Quarantäne-Einträge bleiben höchstens erhalten (älteste fallen weg). */
export const MAX_QUARANTINE_ENTRIES = 10;

/** So viele Zeichen belegt ein Rohtext oder ein Datensatz in der Quarantäne höchstens (Rest wird gekürzt). */
export const MAX_QUARANTINE_CHARS = 100_000;

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
  /** True, wenn Rohtext oder Datensätze wegen der Größengrenze gekürzt wurden. */
  readonly truncated?: true;
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

/** Kürzt einen Datensatz, dessen JSON die Grenze überschreitet, auf eine Text-Vorschau. */
function limitItem(item: unknown): { readonly value: unknown; readonly cut: boolean } {
  const json = JSON.stringify(item) ?? '';
  return json.length > MAX_QUARANTINE_CHARS
    ? { value: json.slice(0, MAX_QUARANTINE_CHARS), cut: true }
    : { value: item, cut: false };
}

/** Baut den Quarantäne-Eintrag; Rohtext und Datensätze werden auf {@link MAX_QUARANTINE_CHARS} begrenzt. */
export function buildQuarantineRecord(
  key: string,
  reason: QuarantineReason,
  payload: { readonly items?: readonly unknown[]; readonly raw?: string },
  at: Date,
): QuarantineRecord {
  const base = { key, reason, at: at.toISOString() };
  if (payload.raw !== undefined) {
    const cut = payload.raw.length > MAX_QUARANTINE_CHARS;
    const raw = cut ? payload.raw.slice(0, MAX_QUARANTINE_CHARS) : payload.raw;
    return { ...base, raw, ...(cut ? { truncated: true as const } : {}) };
  }
  const limited = (payload.items ?? []).map(limitItem);
  const cut = limited.some((l) => l.cut);
  return { ...base, items: limited.map((l) => l.value), ...(cut ? { truncated: true as const } : {}) };
}

/** Meldung für Hinweise: "2 beschädigte Einträge (diary) wurden aussortiert und gesichert." */
export function describeNotices(notices: readonly QuarantineNotice[]): string {
  const total = notices.reduce((sum, n) => sum + n.count, 0);
  if (total === 0) return '';
  const subject = total === 1 ? '1 beschädigter Datensatz wurde' : `${total} beschädigte Datensätze wurden`;
  const unsaved = notices.some((n) => !n.saved);
  return `${subject} aussortiert${unsaved ? '' : ' und gesichert'}.`;
}
