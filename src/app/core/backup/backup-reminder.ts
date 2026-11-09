/** Reine Regeln für den dezenten Backup-Hinweis. */

export const REMINDER_DAYS_SINCE_BACKUP = 14;
export const REMINDER_DAYS_NEVER_BACKED_UP = 7;
export const REMINDER_NEW_ENTRIES = 50;
export const REMINDER_SNOOZE_DAYS = 3;

const DAY_MS = 86_400_000;

export interface ReminderInput {
  readonly now: number;
  /** ISO-Zeitpunkt des letzten Backups oder null. */
  readonly lastBackup: string | null;
  /** createdAt-Zeitpunkte aller Tagebucheinträge (ISO). */
  readonly entryDates: readonly string[];
  /** ISO-Zeitpunkt, bis zu dem "Später" gilt, oder null. */
  readonly snoozedUntil: string | null;
}

function toMillis(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Ob jetzt ein Backup-Hinweis gezeigt werden soll. */
export function needsBackupReminder(input: ReminderInput): boolean {
  const times = input.entryDates.map(toMillis).filter((t): t is number => t !== null);
  if (times.length === 0) return false;

  const snoozed = toMillis(input.snoozedUntil);
  if (snoozed !== null && snoozed > input.now) return false;

  const last = toMillis(input.lastBackup);
  if (last === null) {
    const oldest = Math.min(...times);
    return input.now - oldest >= REMINDER_DAYS_NEVER_BACKED_UP * DAY_MS;
  }

  const sinceBackup = times.filter((t) => t > last).length;
  if (sinceBackup === 0) return false;
  if (sinceBackup >= REMINDER_NEW_ENTRIES) return true;
  return input.now - last >= REMINDER_DAYS_SINCE_BACKUP * DAY_MS;
}

/** Zeitpunkt, bis zu dem "Später" den Hinweis ausblendet. */
export function snoozeUntil(now: number): string {
  return new Date(now + REMINDER_SNOOZE_DAYS * DAY_MS).toISOString();
}
