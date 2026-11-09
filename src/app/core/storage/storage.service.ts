import { Injectable, OnDestroy, signal } from '@angular/core';
import { CURRENT_SCHEMA_VERSION, SCHEMA_KEY, applyMigrations, readSchemaVersion } from './storage-schema';
import {
  QuarantineNotice,
  QuarantineReason,
  buildQuarantineRecord,
  isQuarantineKey,
  keysToPrune,
  quarantineKey,
} from './storage-quarantine';

/** Art eines Schreibfehlers. */
export type StorageErrorKind = 'quota' | 'unavailable' | 'unknown';

/** Aktueller Schreibfehler: welche Schlüssel noch nicht gesichert sind und warum. */
export interface StorageError {
  readonly kind: StorageErrorKind;
  readonly keys: readonly string[];
  readonly at: number;
}

/** Ergebnis einer Bereinigung (Struktur wie `SanitizeResult`, hier ohne Abhängigkeit zu `state/`). */
export interface Sanitized<T> {
  readonly items: readonly T[];
  readonly rejected: readonly unknown[];
  readonly repaired: number;
}

const QUOTA_ERROR_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

function classifyError(error: unknown): StorageErrorKind {
  const name = (error as { name?: string } | null)?.name;
  return name && QUOTA_ERROR_NAMES.has(name) ? 'quota' : 'unknown';
}

/**
 * Einfache, synchron lesbare Key-Value-Persistenz für das MVP-Gerüst.
 *
 * Nutzt aktuell `localStorage` (funktioniert im Web-Dev-Server sofort, offline-first).
 * Die API ist bewusst schmal gehalten, damit sie später 1:1 gegen Capacitor
 * **Preferences** / SQLite ausgetauscht werden kann, ohne die Stores zu ändern.
 */
@Injectable({ providedIn: 'root' })
export class StorageService implements OnDestroy {
  private readonly prefix = 'nutritrack:';
  /** Schreibzugriffe werden gebündelt (siehe {@link set}); so lange verzögert sich ein Schreiben höchstens. */
  static readonly WRITE_DELAY_MS = 250;
  /** Wartezeiten der automatischen Wiederholungen nach einem Schreibfehler (danach nur noch manuell/bei neuen Schreibzugriffen). */
  static readonly RETRY_DELAYS_MS: readonly number[] = [5000, 60000];
  private readonly pending = new Map<string, unknown>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryIndex = 0;
  private readonly corruptSeen = new Map<string, string>();
  private readonly onHide = (): void => void this.flush();

  private readonly _writeFailures = signal(0);
  /** Zähler fehlgeschlagener Schreibvorgänge (Speicher voll/gesperrt). */
  readonly writeFailures = this._writeFailures.asReadonly();
  private readonly _lastError = signal<StorageError | null>(null);
  /** Aktueller Schreibfehler; `null`, sobald alles geschrieben ist. */
  readonly lastError = this._lastError.asReadonly();
  private readonly _schemaNewer = signal(false);
  /** True, wenn der Speicher von einer neueren App-Version stammt (wird dann nicht verändert). */
  readonly schemaNewer = this._schemaNewer.asReadonly();
  private readonly _notices = signal<readonly QuarantineNotice[]>([]);
  /** Aussortierte Daten dieser Sitzung (für einen Hinweis in der Oberfläche). */
  readonly quarantineNotices = this._notices.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onHide);
      window.addEventListener('beforeunload', this.onHide);
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onHide);
    this.migrate();
  }

  ngOnDestroy(): void {
    clearTimeout(this.retryTimer);
    this.flush();
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onHide);
      window.removeEventListener('beforeunload', this.onHide);
    }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onHide);
  }

  /** Liest einen JSON-Wert; gibt `fallback` zurück, wenn leer oder defekt (defekter Rohtext wird in Quarantäne gesichert). */
  get<T>(key: string, fallback: T): T {
    if (this.pending.has(key)) return JSON.parse(JSON.stringify(this.pending.get(key))) as T;
    const raw = this.readRaw(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.quarantineRaw(key, raw);
      return fallback;
    }
  }

  /**
   * Liest eine Liste und bereinigt sie mit `sanitize`: Verworfenes kommt in Quarantäne,
   * die bereinigte Liste wird zurückgeschrieben (damit sich die Meldung nicht wiederholt).
   */
  getSanitized<T>(key: string, sanitize: (raw: unknown) => Sanitized<T>): T[] {
    const result = sanitize(this.get<unknown>(key, null));
    if (result.rejected.length > 0) this.quarantine(key, result.rejected, 'invalid');
    if (result.rejected.length > 0 || result.repaired > 0) this.set(key, result.items);
    return [...result.items];
  }

  /**
   * Schreibt einen JSON-Wert gebündelt: Mehrfach-Schreibzugriffe auf denselben Schlüssel
   * innerhalb von {@link WRITE_DELAY_MS} ergeben einen einzigen `localStorage`-Zugriff.
   * Lesen (`get`, `snapshot`, …) sieht sofort den neuesten Wert; beim Verlassen der Seite
   * (`pagehide`, `visibilitychange`, `beforeunload`) wird sofort geschrieben.
   * Scheitert das Schreiben, bleibt der Wert vorgemerkt, `lastError` wird gesetzt und es folgen Wiederholungen
   * (siehe {@link RETRY_DELAYS_MS}).
   */
  set<T>(key: string, value: T): void {
    this.pending.set(key, value);
    this.flushTimer ??= setTimeout(() => this.flush(), StorageService.WRITE_DELAY_MS);
  }

  /** Anzahl noch nicht dauerhaft geschriebener Schlüssel. */
  pendingCount(): number {
    return this.pending.size;
  }

  /** Schreibt alle gebündelten Werte sofort; Erfolg = nichts mehr vorgemerkt. */
  flush(): boolean {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.pending.size === 0) return true;
    const backend = this.backend();
    const failed: string[] = [];
    let kind: StorageErrorKind = backend ? 'unknown' : 'unavailable';
    for (const [key, value] of Array.from(this.pending)) {
      try {
        if (!backend) throw new Error('Speicher nicht verfügbar');
        backend.setItem(this.prefix + key, JSON.stringify(value));
        this.pending.delete(key);
      } catch (e) {
        failed.push(key);
        if (backend) kind = classifyError(e);
        console.error(`NutriTrack: Schreiben von "${key}" fehlgeschlagen`, e);
      }
    }
    if (failed.length === 0) {
      this.markWritten();
      return true;
    }
    this._writeFailures.update((n) => n + 1);
    this._lastError.set({ kind, keys: failed, at: Date.now() });
    this.scheduleRetry();
    return false;
  }

  /** Wiederholt das Schreiben sofort (Knopf im Fehler-Banner). */
  retryNow(): boolean {
    return this.flush();
  }

  /** Entfernt einen Schlüssel. */
  remove(key: string): void {
    this.pending.delete(key);
    try {
      this.backend()?.removeItem(this.prefix + key);
    } catch (e) {
      console.error(`NutriTrack: Entfernen von "${key}" fehlgeschlagen`, e);
    }
  }

  /** Löscht alle NutriTrack-Schlüssel (für "Daten zurücksetzen"), auch die Quarantäne. Die Schema-Version bleibt gesetzt. */
  clearAll(): void {
    this.pending.clear();
    this.markWritten();
    const b = this.backend();
    if (!b) return;
    try {
      Object.keys(this.rawEntries()).forEach((k) => b.removeItem(this.prefix + k));
      b.setItem(this.prefix + SCHEMA_KEY, JSON.stringify(CURRENT_SCHEMA_VERSION));
    } catch (e) {
      console.error('NutriTrack: Zurücksetzen fehlgeschlagen', e);
    }
  }

  /**
   * Liest alle NutriTrack-Schlüssel (ohne Präfix) als geparste JSON-Werte, z. B. für ein Backup.
   * Nicht lesbare Einträge und die Schema-Version werden ausgelassen.
   */
  snapshot(): Record<string, unknown> {
    this.flush();
    const stored = Object.fromEntries(
      Object.entries(this.rawEntries()).flatMap(([key, raw]) => {
        if (key === SCHEMA_KEY) return [];
        try {
          return [[key, JSON.parse(raw) as unknown]];
        } catch {
          return [];
        }
      }),
    );
    // Werte, die gerade nicht geschrieben werden konnten, gehören trotzdem in die Sicherung.
    const unsaved = Object.fromEntries(Array.from(this.pending).map(([k, v]) => [k, JSON.parse(JSON.stringify(v)) as unknown]));
    return { ...stored, ...unsaved };
  }

  /**
   * Ersetzt alle NutriTrack-Schlüssel (außer der Quarantäne) durch `data` (z. B. Backup-Import).
   * Die Schema-Version wird dabei entfernt; der nächste Start migriert die Daten erneut.
   * Schlägt das Schreiben fehl (Speicher voll), wird der vorherige Stand wiederhergestellt.
   * @returns `true` bei Erfolg.
   */
  replaceAll(data: Readonly<Record<string, unknown>>): boolean {
    this.pending.clear();
    const b = this.backend();
    if (!b) return false;
    const previous = this.rawEntries();
    const removable = Object.fromEntries(Object.entries(previous).filter(([k]) => !isQuarantineKey(k)));
    try {
      this.writeRaw(b, removable, {});
      Object.entries(data).forEach(([key, value]) => b.setItem(this.prefix + key, JSON.stringify(value)));
      this.markWritten();
      return true;
    } catch (e) {
      console.error('NutriTrack: Ersetzen der Daten fehlgeschlagen, vorheriger Stand wird wiederhergestellt', e);
      this.restoreRaw(b, previous);
      return false;
    }
  }

  /**
   * Legt Verworfenes (Datensätze oder unlesbaren Rohtext) unter einem Quarantäne-Schlüssel ab
   * und merkt einen Hinweis für die Oberfläche. Wirft nie.
   */
  quarantine(source: string, items: readonly unknown[], reason: QuarantineReason, raw?: string): void {
    if (items.length === 0 && raw === undefined) return;
    const b = this.backend();
    const now = new Date();
    const record = buildQuarantineRecord(source, reason, raw === undefined ? { items } : { raw }, now);
    let saved = false;
    try {
      if (!b) throw new Error('Speicher nicht verfügbar');
      b.setItem(this.prefix + quarantineKey(source, now.getTime()), JSON.stringify(record));
      keysToPrune(Object.keys(this.rawEntries())).forEach((k) => b.removeItem(this.prefix + k));
      saved = true;
    } catch (e) {
      console.error(`NutriTrack: Quarantäne für "${source}" konnte nicht gesichert werden`, e);
    }
    this._notices.update((list) => [...list, { key: source, count: raw === undefined ? items.length : 1, saved }]);
  }

  /** Blendet die Quarantäne-Hinweise aus. */
  dismissQuarantineNotices(): void {
    this._notices.set([]);
  }

  private quarantineRaw(key: string, raw: string): void {
    if (this.corruptSeen.get(key) === raw) return;
    this.corruptSeen.set(key, raw);
    this.quarantine(key, [], 'parse', raw);
  }

  private markWritten(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.retryIndex = 0;
    this._lastError.set(null);
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== undefined) return;
    const delay = StorageService.RETRY_DELAYS_MS[this.retryIndex];
    if (delay === undefined) return;
    this.retryIndex++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.flush();
    }, delay);
  }

  /** Hebt Bestandsdaten auf die aktuelle Schema-Version (Datenstand ohne Version zählt als 0). */
  private migrate(): void {
    const b = this.backend();
    if (!b) return;
    try {
      const from = readSchemaVersion(this.readParsed(SCHEMA_KEY));
      if (from === CURRENT_SCHEMA_VERSION) return;
      const data = this.snapshotWithoutFlush();
      const result = applyMigrations(data, from);
      if (result.newer) {
        this._schemaNewer.set(true);
        console.error(`NutriTrack: Speicher hat Schema-Version ${from}, diese App kennt ${CURRENT_SCHEMA_VERSION}.`);
        return;
      }
      Object.entries(result.patch).forEach(([key, value]) =>
        value === undefined ? b.removeItem(this.prefix + key) : b.setItem(this.prefix + key, JSON.stringify(value)),
      );
      b.setItem(this.prefix + SCHEMA_KEY, JSON.stringify(result.version));
    } catch (e) {
      console.error('NutriTrack: Migration des Speichers fehlgeschlagen', e);
    }
  }

  private snapshotWithoutFlush(): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(this.rawEntries()).flatMap(([key, raw]) => {
        if (key === SCHEMA_KEY || isQuarantineKey(key)) return [];
        try {
          return [[key, JSON.parse(raw) as unknown]];
        } catch {
          return [];
        }
      }),
    );
  }

  private readRaw(key: string): string | null {
    try {
      return this.backend()?.getItem(this.prefix + key) ?? null;
    } catch (e) {
      console.error(`NutriTrack: Lesen von "${key}" fehlgeschlagen`, e);
      return null;
    }
  }

  private readParsed(key: string): unknown {
    const raw = this.readRaw(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  /** Alle NutriTrack-Einträge als Rohstrings (Schlüssel ohne Präfix). */
  private rawEntries(): Record<string, string> {
    const b = this.backend();
    if (!b) return {};
    try {
      const keys = Array.from({ length: b.length }, (_, i) => b.key(i)).filter(
        (k): k is string => !!k && k.startsWith(this.prefix),
      );
      return Object.fromEntries(keys.map((k) => [k.slice(this.prefix.length), b.getItem(k) ?? 'null']));
    } catch (e) {
      console.error('NutriTrack: Speicher konnte nicht gelesen werden', e);
      return {};
    }
  }

  /** Entfernt alle Schlüssel aus `remove` und schreibt danach `write` (Rohstrings). */
  private writeRaw(b: Storage, remove: Record<string, string>, write: Record<string, string>): void {
    Object.keys(remove).forEach((k) => b.removeItem(this.prefix + k));
    Object.entries(write).forEach(([k, v]) => b.setItem(this.prefix + k, v));
  }

  private restoreRaw(b: Storage, previous: Record<string, string>): void {
    try {
      this.writeRaw(b, this.rawEntries(), previous);
    } catch (e) {
      console.error('NutriTrack: Wiederherstellung des vorherigen Stands fehlgeschlagen', e);
    }
  }

  private backend(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }
}
