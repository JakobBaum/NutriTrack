/**
 * Schema-Version des Laufzeit-Speichers (Rolle 18 F4). Rein, ohne Browser-Abhängigkeit.
 *
 * Bestandsdaten haben keinen Versionsschlüssel und zählen als Version 0. Jeder Migrationsschritt `n`
 * hebt von Version `n-1` auf `n` und liefert nur die geänderten Schlüssel (Wert `undefined` = Schlüssel entfernen).
 * Schritte müssen wiederholbar sein: ein Backup-Import schreibt ohne Versionsschlüssel und wird daher erneut migriert.
 */

/** Speicherschlüssel (ohne Präfix) der Schema-Version. Wird weder exportiert noch importiert. */
export const SCHEMA_KEY = 'schemaVersion';
/** Aktuelle Schema-Version dieser App. Beim Erhöhen einen Schritt in {@link MIGRATIONS} ergänzen. */
export const CURRENT_SCHEMA_VERSION = 1;

/** Geparste Speicherwerte: Schlüssel (ohne Präfix) → Wert. */
export type StoredData = Readonly<Record<string, unknown>>;
/** Ein Migrationsschritt: liefert die zu ändernden Schlüssel. */
export type Migration = (data: StoredData) => Readonly<Record<string, unknown>>;

/** Schritt 1: Bestandsdaten bekommen erstmals eine Version. Inhalte bereinigen die Stores beim Laden (Sanitizing). */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: () => ({}),
};

export interface MigrationResult {
  /** Version nach der Migration (bei neueren Daten die gefundene Version). */
  readonly version: number;
  /** Zu schreibende Änderungen; `undefined` als Wert entfernt den Schlüssel. */
  readonly patch: Readonly<Record<string, unknown>>;
  /** True, wenn die Daten von einer neueren App-Version stammen und nicht angefasst wurden. */
  readonly newer: boolean;
}

/** Liest die gespeicherte Version; alles außer einer ganzen Zahl >= 0 zählt als 0. */
export function readSchemaVersion(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

/** Wendet alle Schritte von `from + 1` bis `to` an; spätere Schritte sehen den Stand nach den früheren. */
export function applyMigrations(
  data: StoredData,
  from: number,
  to: number = CURRENT_SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): MigrationResult {
  if (from > to) return { version: from, patch: {}, newer: true };
  let patch: Readonly<Record<string, unknown>> = {};
  for (let v = from + 1; v <= to; v++) {
    const step = migrations[v];
    if (!step) continue;
    const view = { ...data, ...patch };
    patch = { ...patch, ...step(view) };
  }
  return { version: to, patch, newer: false };
}
