import { sanitizeBackupData } from './backup-sanitize';
import { SCHEMA_KEY } from '../storage/storage-schema';
import { isQuarantineKey } from '../storage/storage-quarantine';

/**
 * Reine Funktionen für Daten-Backups (Export/Import aller `nutritrack:`-Schlüssel).
 * Keine Abhängigkeit zu Angular oder Browser-APIs, damit alles unit-testbar bleibt.
 */

/** Kennung im Backup, damit fremde JSON-Dateien sicher erkannt werden. */
export const BACKUP_FORMAT = 'nutritrack-backup';
/** Aktuelle Schema-Version des Backups. */
export const BACKUP_VERSION = 1;
/** Speicherschlüssel (ohne Präfix) für das Datum des letzten Exports. Wird nicht mitexportiert. */
export const LAST_BACKUP_KEY = 'lastBackup';
/** Obergrenze für die Dateigröße beim Import (Schutz vor versehentlich riesigen Dateien). */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ARRAY_KEYS = ['diary', 'recipes', 'savedMeals', 'customFoods', 'favorites', 'weight'] as const;
const NULLABLE_OBJECT_KEYS = ['profile', 'shopping'] as const;
/** Frühere KI-Verbindung (eigener Key, Server-Adresse): wird weder exportiert noch importiert. */
const AI_KEY = 'ai-config';
/** Übersetzungs-Cache: jederzeit neu aufbaubar, gehört nicht ins Backup. */
const TRANSLATION_CACHE_KEY = 'translations';
/** Automatische Sicherung vor Import, Wiederherstellen und Zurücksetzen (siehe BackupService). */
export const AUTO_SNAPSHOT_KEY = 'autosnapshot';
/** Zeitpunkt, bis zu dem die Backup-Erinnerung ruht. */
export const REMINDER_SNOOZE_KEY = 'backupReminderSnooze';
/** Früherer eigener Rezeptsuche-Key (entfernt): wird weder exportiert noch importiert. */
const RECIPE_SEARCH_KEY = 'recipe-search-config';
const NEVER_BACKED_UP_KEYS: ReadonlySet<string> = new Set([
  LAST_BACKUP_KEY,
  AI_KEY,
  RECIPE_SEARCH_KEY,
  TRANSLATION_CACHE_KEY,
  SCHEMA_KEY,
  AUTO_SNAPSHOT_KEY,
  REMINDER_SNOOZE_KEY,
]);
/** Geräte-interne Schlüssel (Meta, Auto-Sicherung, Quarantäne): weder Export noch Import. */
export const isNeverBackedUp = (key: string): boolean => NEVER_BACKED_UP_KEYS.has(key) || isQuarantineKey(key);

/** Gespeicherte Daten: Schlüssel (ohne Präfix) → bereits geparster JSON-Wert. */
export type BackupData = Readonly<Record<string, unknown>>;

/** Aufbau einer Backup-Datei. */
export interface BackupFile {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly exportedAt: string;
  readonly data: BackupData;
}

/** Ergebnis der Prüfung einer Backup-Datei. */
export type BackupParseResult =
  | { readonly ok: true; readonly backup: BackupFile; readonly cleanup: BackupCleanup }
  | { readonly ok: false; readonly error: string };

/** Was beim Einlesen repariert oder aussortiert wurde. */
export interface BackupCleanup {
  readonly repaired: number;
  readonly skipped: number;
  readonly quarantined: Readonly<Record<string, readonly unknown[]>>;
}

/** Anzahl der wichtigsten Datensätze für die Vorschau vor dem Import. */
export interface BackupCounts {
  readonly diary: number;
  readonly recipes: number;
  readonly savedMeals: number;
  readonly customFoods: number;
  readonly shoppingItems: number;
  readonly hasProfile: boolean;
  readonly weightEntries: number;
  readonly favorites: number;
}

export const BACKUP_ERRORS = {
  notJson: 'Die Datei konnte nicht gelesen werden: Sie enthält kein gültiges JSON.',
  foreign: 'Diese Datei ist kein NutriTrack-Backup.',
  newerVersion: 'Dieses Backup stammt aus einer neueren NutriTrack-Version. Bitte zuerst die App aktualisieren.',
  badVersion: 'Die Backup-Version wird nicht unterstützt.',
  badDate: 'Das Backup ist beschädigt: Das Exportdatum fehlt oder ist ungültig.',
  badData: 'Das Backup ist beschädigt: Der Datenbereich fehlt oder ist ungültig.',
  badContent: 'Das Backup ist beschädigt: Einträge sind unvollständig oder fehlerhaft.',
  tooLarge: 'Die Datei ist zu groß für ein NutriTrack-Backup.',
  empty: 'Die Datei ist leer.',
} as const;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Dateiname im Format `nutritrack-backup-YYYY-MM-DD.json` (lokales Datum). */
export function backupFileName(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${BACKUP_FORMAT}-${y}-${m}-${d}.json`;
}

/** Erstellt das Backup-Objekt aus den gespeicherten Daten (ohne Meta-Schlüssel und KI-Verbindung). */
export function buildBackup(data: BackupData, now: Date): BackupFile {
  const entries = Object.entries(data).filter(([key]) => !isNeverBackedUp(key));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: Object.fromEntries(entries),
  };
}

/** Serialisiert ein Backup lesbar eingerückt. */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

function validateVersion(version: unknown): string | null {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return BACKUP_ERRORS.badVersion;
  }
  if (version > BACKUP_VERSION) return BACKUP_ERRORS.newerVersion;
  return null;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Prüft die bekannten Schlüssel auf ihren erwarteten Typ. */
function validateKnownKeys(data: Record<string, unknown>): boolean {
  const arraysOk = ARRAY_KEYS.every((k) => !(k in data) || (Array.isArray(data[k]) && (data[k] as unknown[]).every(isPlainObject)));
  const objectsOk = NULLABLE_OBJECT_KEYS.every((k) => !(k in data) || data[k] === null || isPlainObject(data[k]));
  return arraysOk && objectsOk;
}

function validateData(data: unknown): data is Record<string, unknown> {
  if (!isPlainObject(data)) return false;
  const keysOk = Object.keys(data).every((k) => KEY_PATTERN.test(k) && !FORBIDDEN_KEYS.has(k));
  return keysOk && validateKnownKeys(data);
}

/** Prüft ein bereits geparstes Objekt streng gegen das Backup-Schema. */
export function validateBackup(value: unknown): BackupParseResult {
  if (!isPlainObject(value) || value['format'] !== BACKUP_FORMAT) {
    return { ok: false, error: BACKUP_ERRORS.foreign };
  }
  const versionError = validateVersion(value['version']);
  if (versionError) return { ok: false, error: versionError };
  if (!isValidIsoDate(value['exportedAt'])) return { ok: false, error: BACKUP_ERRORS.badDate };
  const data = value['data'];
  if (!validateData(data)) return { ok: false, error: BACKUP_ERRORS.badData };
  const cleaned = sanitizeBackupData(data);
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: value['version'] as number,
    exportedAt: value['exportedAt'],
    data: { ...cleaned.data },
  };
  const cleanup: BackupCleanup = { repaired: cleaned.repaired, skipped: cleaned.skipped, quarantined: cleaned.quarantined };
  return { ok: true, backup, cleanup };
}

/** Parst den Dateiinhalt und validiert ihn. Wirft nie. */
export function parseBackup(text: string): BackupParseResult {
  if (text.trim() === '') return { ok: false, error: BACKUP_ERRORS.empty };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: BACKUP_ERRORS.notJson };
  }
  return validateBackup(parsed);
}

const lengthOf = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

/** Zählt die Datensätze eines Backups für die Vorschau. */
export function countBackup(data: BackupData): BackupCounts {
  const shopping = data['shopping'];
  return {
    diary: lengthOf(data['diary']),
    recipes: lengthOf(data['recipes']),
    savedMeals: lengthOf(data['savedMeals']),
    customFoods: lengthOf(data['customFoods']),
    shoppingItems: isPlainObject(shopping) ? lengthOf(shopping['items']) : 0,
    hasProfile: isPlainObject(data['profile']),
    weightEntries: lengthOf(data['weight']),
    favorites: lengthOf(data['favorites']),
  };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Vorschautext, z. B. "123 Tagebucheinträge, 4 Rezepte, Profil". */
export function describeCounts(c: BackupCounts): string {
  const parts = [
    plural(c.diary, 'Tagebucheintrag', 'Tagebucheinträge'),
    plural(c.recipes, 'Rezept', 'Rezepte'),
    plural(c.savedMeals, 'gespeicherte Mahlzeit', 'gespeicherte Mahlzeiten'),
    plural(c.customFoods, 'eigenes Lebensmittel', 'eigene Lebensmittel'),
    ...(c.shoppingItems > 0 ? [plural(c.shoppingItems, 'Einkaufsposition', 'Einkaufspositionen')] : []),
    ...(c.weightEntries > 0 ? [plural(c.weightEntries, 'Gewichtseintrag', 'Gewichtseinträge')] : []),
    ...(c.favorites > 0 ? [plural(c.favorites, 'Favorit', 'Favoriten')] : []),
    ...(c.hasProfile ? ['Profil'] : []),
  ];
  return parts.join(', ');
}

/** Daten, die beim Import geschrieben werden: Backup-Inhalt ohne Geräte-interne Schlüssel (KI-Verbindung, Meta, Quarantäne). */
export function prepareRestore(backup: BackupData): BackupData {
  return Object.fromEntries(Object.entries(backup).filter(([key]) => !isNeverBackedUp(key)));
}

/** Formatiert ein ISO-Datum als "06.11.2026, 14:05" (lokal); `null` bei ungültiger Eingabe. */
export function formatBackupDate(iso: unknown): string | null {
  if (!isValidIsoDate(iso)) return null;
  const d = new Date(iso);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
