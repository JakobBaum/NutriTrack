/**
 * Automatische Sicherung (Rolle 12 F3/F6, Rolle 13 F12): Vor Import, Wiederherstellen und Zurücksetzen
 * bleibt der alte Stand als eine Sicherung auf dem Gerät erhalten. Rein, ohne Browser-Abhängigkeit.
 */
import {
  BACKUP_FORMAT,
  BackupData,
  BackupFile,
  buildBackup,
  countBackup,
  describeCounts,
  formatBackupDate,
  isNeverBackedUp,
  validateBackup,
} from './backup';

export type SafetyReason = 'import' | 'restore' | 'reset';

/** Gespeicherte Auto-Sicherung. */
export interface SafetySnapshot {
  readonly at: string;
  readonly reason: SafetyReason;
  readonly backup: BackupFile;
}

const REASONS: ReadonlySet<string> = new Set(['import', 'restore', 'reset']);
const REASON_LABEL: Readonly<Record<SafetyReason, string>> = {
  import: 'vor dem Import',
  restore: 'vor der Wiederherstellung',
  reset: 'vor dem Zurücksetzen',
};

const isFilled = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

/** True, wenn es Nutzerdaten gibt, die eine Sicherung lohnen (Meta-Schlüssel zählen nicht). */
export function hasBackupContent(data: BackupData): boolean {
  return Object.entries(data).some(([key, value]) => !isNeverBackedUp(key) && isFilled(value));
}

/** Baut die Auto-Sicherung aus dem aktuellen Stand; `null`, wenn nichts zu sichern ist. */
export function buildSafetySnapshot(data: BackupData, reason: SafetyReason, now: Date): SafetySnapshot | null {
  if (!hasBackupContent(data)) return null;
  return { at: now.toISOString(), reason, backup: buildBackup(data, now) };
}

/** Prüft einen gespeicherten Wert; `null`, wenn er keine brauchbare Auto-Sicherung ist. */
export function readSafetySnapshot(raw: unknown): SafetySnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r['at'] !== 'string' || typeof r['reason'] !== 'string' || !REASONS.has(r['reason'])) return null;
  const backup = r['backup'];
  if (typeof backup !== 'object' || backup === null || (backup as Record<string, unknown>)['format'] !== BACKUP_FORMAT) return null;
  const checked = validateBackup(backup);
  if (!checked.ok) return null;
  return { at: r['at'], reason: r['reason'] as SafetyReason, backup: checked.backup };
}

/** Beschreibung für die Oberfläche, z. B. "06.11.2026, 14:05 (vor dem Zurücksetzen): 12 Tagebucheinträge, Profil". */
export function describeSafetySnapshot(snapshot: SafetySnapshot): string {
  const when = formatBackupDate(snapshot.at) ?? 'unbekannt';
  return `${when} (${REASON_LABEL[snapshot.reason]}): ${describeCounts(countBackup(snapshot.backup.data))}`;
}
