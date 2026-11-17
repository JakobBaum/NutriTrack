import { Injectable, OnDestroy, Signal, computed, signal } from '@angular/core';
import { isConsentKey, isLockExemptKey } from './storage-foreign';
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

/** Ausgang von {@link StorageService.replaceAll}: ersetzt, zurückgerollt oder (schlimmster Fall) Rückrollen gescheitert. */
export type ReplaceOutcome = 'ok' | 'failed' | 'rollbackFailed';

/** Ergebnis von {@link StorageService.snapshotDetailed}. */
export interface SnapshotResult {
  readonly data: Record<string, unknown>;
  /** Schlüssel (ohne Präfix), die nicht lesbar waren und deshalb in `data` fehlen. */
  readonly skippedKeys: readonly string[];
}

/** Was für eine erneute Quarantäne-Sicherung nötig ist. */
interface UnsecuredData {
  readonly items: readonly unknown[];
  readonly reason: QuarantineReason;
  readonly raw?: string;
  /** Bereinigter Stand, der nach nachgeholter Sicherung zurückgeschrieben wird (`null` = Schlüssel entfernen). */
  readonly cleaned?: { readonly value: unknown };
}

/** Änderung eines nicht sperrenden Schlüssels in einem anderen Fenster (`seq` macht gleiche Schlüssel unterscheidbar). */
export interface ForeignChange {
  readonly key: string;
  readonly seq: number;
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
  private readonly onStorageEvent = (e: StorageEvent): void => this.handleForeignChange(e);

  private readonly _writeFailures = signal(0);
  /** Zähler fehlgeschlagener Schreibvorgänge (Speicher voll/gesperrt). */
  readonly writeFailures = this._writeFailures.asReadonly();
  private readonly _lastError = signal<StorageError | null>(null);
  /** Migrationsfehler: bleibt, bis eine Migration wirklich gelingt (nicht durch Schreiben/Löschen zu beheben). */
  private readonly _migrationError = signal<StorageError | null>(null);
  /** Aktueller Schreib- oder Migrationsfehler; `null`, sobald alles geschrieben und migriert ist. */
  readonly lastError = computed(() => this._lastError() ?? this._migrationError());
  /** Schlüssel, deren Rohdaten (noch) nicht in die Quarantäne gesichert werden konnten: Schreiben/Löschen wird abgelehnt. */
  private readonly unsecured = new Map<string, UnsecuredData>();
  /** Spiegel von `unsecured` als Signal, damit Stores ihre Schreibsperre reaktiv ableiten können. */
  private readonly _unsecuredKeys = signal<ReadonlySet<string>>(new Set());
  /** Zähler der Änderungen an der Zustimmung in einem anderen Fenster (Ereignisse im selben Takt gehen nicht verloren). */
  private readonly _consentChanges = signal(0);
  readonly consentChanges = this._consentChanges.asReadonly();
  private foreignSeq = 0;
  private readonly _foreignChange = signal<ForeignChange | null>(null);
  /** Letzte Änderung eines Schlüssels in einem anderen Fenster, die nicht sperrt (z. B. Zustimmung): neu einlesen. */
  readonly foreignChange = this._foreignChange.asReadonly();
  private readonly _schemaNewer = signal(false);
  /** True, wenn der Speicher von einer neueren App-Version stammt (wird dann nicht verändert). */
  readonly schemaNewer = this._schemaNewer.asReadonly();
  private readonly _externalChange = signal(false);
  /** True, wenn ein anderes Fenster/Tab App-Daten geändert hat (dieses Fenster schreibt dann nichts mehr; Neuladen nötig). */
  readonly externalChange = this._externalChange.asReadonly();
  /** True, wenn dieses Fenster nichts schreiben darf (neueres Schema oder Änderung in einem anderen Fenster). */
  readonly writeLocked = computed(() => this._schemaNewer() || this._externalChange());
  private readonly _notices = signal<readonly QuarantineNotice[]>([]);
  /** Aussortierte Daten dieser Sitzung (für einen Hinweis in der Oberfläche). */
  readonly quarantineNotices = this._notices.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onHide);
      window.addEventListener('beforeunload', this.onHide);
      window.addEventListener('storage', this.onStorageEvent);
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
      window.removeEventListener('storage', this.onStorageEvent);
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
    // Bei Schreibsperre (Migration, anderes Fenster, neueres Schema) bleiben die Rohdaten unverändert und es wird nichts
    // geschrieben: Das folgende set würde abgelehnt, und jeder Start legte sonst einen neuen Quarantäne-Eintrag an.
    // Bei Migrationssperre wird das Verworfene aber vorgemerkt und nach der Sperre vor dem ersten Schreiben gesichert.
    if (this.isWriteBlocked(key)) {
      this.deferQuarantine(key, result.rejected, { value: result.items });
      return [...result.items];
    }
    const hasRejected = result.rejected.length > 0;
    // Ohne gelungene Sicherung bleibt der Roh-Schlüssel unverändert; die bereinigten Daten gelten nur im Speicher.
    const secured = !hasRejected || this.quarantine(key, result.rejected, 'invalid');
    if (secured && (hasRejected || result.repaired > 0)) this.set(key, result.items);
    return [...result.items];
  }

  /**
   * Liest einen Objekt-Wert (z. B. Profil, Wochenplan) und bereinigt ihn mit `sanitize` (`null` = unbrauchbar).
   * Ein unbrauchbarer Wert kommt in Quarantäne; der Roh-Schlüssel wird nur entfernt, wenn die Sicherung gelang.
   */
  getObject<T>(key: string, sanitize: (raw: unknown) => T | null): T | null {
    const stored = this.get<unknown>(key, null);
    if (stored === null) return null;
    const clean = sanitize(stored);
    if (clean !== null) return clean;
    if (this.isWriteBlocked(key)) {
      this.deferQuarantine(key, [stored], { value: null }); // siehe getSanitized: Rohdaten unverändert, Sicherung später
      return clean;
    }
    if (this.quarantine(key, [stored], 'invalid')) this.remove(key);
    return clean;
  }

  /**
   * Bei Migrationssperre: merkt Verworfenes als ungesichert vor (ohne zu schreiben), damit der Store gesperrt bleibt
   * und `retryNow`/`ensureSecured` die Quarantäne vor dem ersten Schreiben nachholen. Bei Schreibsperre durch ein
   * anderes Fenster oder ein neueres Schema bleibt alles unangetastet. Ein bereits vorgemerkter Schlüssel bleibt unverändert.
   */
  private deferQuarantine(key: string, items: readonly unknown[], cleaned: { readonly value: unknown }): void {
    if (items.length === 0 || this.writeLocked() || this.unsecured.has(key)) return;
    this.setUnsecured(key, { items, reason: 'invalid', cleaned });
    this._notices.update((list) => [...list, { key, count: items.length, saved: false }]);
  }

  /**
   * Schreibt einen JSON-Wert gebündelt: Mehrfach-Schreibzugriffe auf denselben Schlüssel
   * innerhalb von {@link WRITE_DELAY_MS} ergeben einen einzigen `localStorage`-Zugriff.
   * Lesen (`get`, `snapshot`, …) sieht sofort den neuesten Wert; beim Verlassen der Seite
   * (`pagehide`, `visibilitychange`, `beforeunload`) wird sofort geschrieben.
   * Scheitert das Schreiben, bleibt der Wert vorgemerkt, `lastError` wird gesetzt und es folgen Wiederholungen
   * (siehe {@link RETRY_DELAYS_MS}). Stammt der Speicher von einer neueren App-Version, wird nichts geschrieben.
   * `undefined` als Wert entfernt den Schlüssel (wie {@link remove}).
   * @returns `false`, wenn der Wert wegen Schreibsperre (neueres Schema, Änderung in anderem Fenster) verworfen wurde (nichts vorgemerkt).
   */
  set<T>(key: string, value: T): boolean {
    // Daten einer neueren App-Version oder eines anderen Fensters dürfen nicht überschrieben werden (Hinweis: Status-Banner).
    if (this.writeLocked() || this.isMigrationBlocked(key)) return false;
    if (!this.ensureSecured(key)) return false;
    if (value === undefined) {
      this.remove(key);
      return true;
    }
    this.pending.set(key, value);
    this.flushTimer ??= setTimeout(() => this.flush(), StorageService.WRITE_DELAY_MS);
    return true;
  }

  /** Anzahl noch nicht dauerhaft geschriebener Schlüssel. */
  pendingCount(): number {
    return this.pending.size;
  }

  /** Schreibt alle gebündelten Werte sofort; Erfolg = nichts mehr vorgemerkt. */
  flush(): boolean {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.pending.size === 0) {
      this.markWritten();
      return this.unsecured.size === 0;
    }
    // Bei Schreibsperre (neueres Schema, anderes Fenster) bleibt alles vorgemerkt, nichts wird geschrieben.
    if (this.writeLocked()) return false;
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
    this.reportFailure(kind, failed);
    this.scheduleRetry();
    return false;
  }

  /** Wiederholt das Schreiben sofort (Knopf im Fehler-Banner). */
  retryNow(): boolean {
    if (this._migrationError()) this.migrate();
    Array.from(this.unsecured.keys()).forEach((key) => this.ensureSecured(key));
    return this.flush() && !this._migrationError() && this.unsecured.size === 0;
  }

  /** True, wenn die Rohdaten dieses Schlüssels nicht in die Quarantäne gesichert werden konnten (Schreiben wird abgelehnt). */
  hasUnsecured(key: string): boolean {
    return this._unsecuredKeys().has(key);
  }

  /**
   * Schreibsperre für Stores, die `keys` besitzen: allgemeine Sperre, ungesicherte Schlüssel
   * und ein Migrationsfehler (App-Daten dürfen dann nicht als aktuell markiert werden).
   */
  isLockedFor(...keys: readonly string[]): Signal<boolean> {
    return computed(() => this.writeLocked() || keys.some((k) => this.hasUnsecured(k) || this.isMigrationBlocked(k)));
  }

  /** True, wenn Schreiben/Löschen dieses Schlüssels abgelehnt wird (Schreibsperre oder Migrationsfehler). */
  private isWriteBlocked(key: string): boolean {
    return this.writeLocked() || this.isMigrationBlocked(key);
  }

  private isMigrationBlocked(key: string): boolean {
    return this._migrationError() !== null && !isLockExemptKey(key);
  }

  /** Entfernt einen Schlüssel (bei Schreibsperre nicht: die Daten gehören der neueren App-Version bzw. dem anderen Fenster). */
  remove(key: string): void {
    if (this.writeLocked() || this.isMigrationBlocked(key)) return;
    if (!this.ensureSecured(key)) return;
    this.pending.delete(key);
    if (this.pending.size === 0) this.markWritten();
    try {
      this.backend()?.removeItem(this.prefix + key);
    } catch (e) {
      console.error(`NutriTrack: Entfernen von "${key}" fehlgeschlagen`, e);
    }
  }

  /** Löscht alle NutriTrack-Schlüssel (für "Daten zurücksetzen"), auch die Quarantäne. Die Schema-Version bleibt gesetzt.
   * @returns `false`, wenn das Löschen scheiterte (Daten können noch auf dem Gerät liegen).
   */
  clearAll(): boolean {
    this.pending.clear();
    this.setUnsecured(null);
    this.markWritten();
    const b = this.backend();
    if (!b) return true;
    try {
      Object.keys(this.rawEntries()).forEach((k) => b.removeItem(this.prefix + k));
      b.setItem(this.prefix + SCHEMA_KEY, JSON.stringify(CURRENT_SCHEMA_VERSION));
      this._migrationError.set(null);
      this.reevaluateSchema();
      return true;
    } catch (e) {
      console.error('NutriTrack: Zurücksetzen fehlgeschlagen', e);
      return false;
    }
  }

  /**
   * Liest alle NutriTrack-Schlüssel (ohne Präfix) als geparste JSON-Werte, z. B. für ein Backup.
   * Nicht lesbare Einträge und die Schema-Version werden ausgelassen (Schlüssel siehe {@link snapshotDetailed}).
   */
  snapshot(): Record<string, unknown> {
    return this.snapshotDetailed().data;
  }

  /** Wie {@link snapshot}, meldet aber zusätzlich die Schlüssel, die nicht lesbar waren und deshalb fehlen. */
  snapshotDetailed(): SnapshotResult {
    this.flush();
    const { data, skippedKeys } = this.readStored(true);
    // Werte, die gerade nicht geschrieben werden konnten, gehören trotzdem in die Sicherung.
    const unsaved = Object.fromEntries(Array.from(this.pending).map(([k, v]) => [k, JSON.parse(JSON.stringify(v)) as unknown]));
    return { data: { ...data, ...unsaved }, skippedKeys: skippedKeys.filter((k) => !(k in unsaved)) };
  }

  /**
   * Ersetzt alle NutriTrack-Schlüssel (außer der Quarantäne) durch `data` (z. B. Backup-Import).
   * Die Schema-Version wird dabei entfernt; der nächste Start migriert die Daten erneut.
   * Schlägt das Schreiben fehl (Speicher voll), wird der vorherige Stand wiederhergestellt.
   * @returns `ok`; `failed` (alter Stand wiederhergestellt); `rollbackFailed` (auch die Wiederherstellung scheiterte, Daten evtl. unvollständig).
   */
  replaceAll(data: Readonly<Record<string, unknown>>): ReplaceOutcome {
    const queued = new Map(this.pending);
    this.pending.clear();
    const b = this.backend();
    if (!b) return this.keepPending(queued, 'failed');
    const previous = this.rawEntries();
    const removable = Object.fromEntries(Object.entries(previous).filter(([k]) => !isQuarantineKey(k)));
    try {
      this.writeRaw(b, removable, {});
      Object.entries(data).forEach(([key, value]) => b.setItem(this.prefix + key, JSON.stringify(value)));
      this.setUnsecured(null);
      this.markWritten();
      this._migrationError.set(null);
      this.reevaluateSchema();
      return 'ok';
    } catch (e) {
      console.error('NutriTrack: Ersetzen der Daten fehlgeschlagen, vorheriger Stand wird wiederhergestellt', e);
      return this.keepPending(queued, this.restoreRaw(b, previous) ? 'failed' : 'rollbackFailed');
    }
  }

  /** Stellt nicht geschriebene Werte nach einem gescheiterten Import wieder her (sie gehören dem alten Stand). */
  private keepPending(queued: ReadonlyMap<string, unknown>, outcome: ReplaceOutcome): ReplaceOutcome {
    queued.forEach((value, key) => this.pending.set(key, value));
    if (queued.size > 0) this.flushTimer ??= setTimeout(() => this.flush(), StorageService.WRITE_DELAY_MS);
    return outcome;
  }

  /**
   * Legt Verworfenes (Datensätze oder unlesbaren Rohtext) unter einem Quarantäne-Schlüssel ab
   * und merkt einen Hinweis für die Oberfläche. Wirft nie.
   * @returns `true`, wenn die Sicherung geschrieben wurde (oder nichts zu sichern war); sonst darf der Aufrufer die Originale nicht löschen.
   */
  quarantine(source: string, items: readonly unknown[], reason: QuarantineReason, raw?: string): boolean {
    if (items.length === 0 && raw === undefined) return true;
    const data: UnsecuredData = raw === undefined ? { items, reason } : { items, reason, raw };
    const saved = this.writeQuarantine(source, data);
    this.setUnsecured(source, saved ? null : data);
    this._notices.update((list) => [...list, { key: source, count: raw === undefined ? items.length : 1, saved }]);
    return saved;
  }

  /** Schreibt einen Quarantäne-Eintrag. Wirft nie. */
  private writeQuarantine(source: string, data: UnsecuredData): boolean {
    const b = this.writeLocked() ? null : this.backend();
    const now = new Date();
    const record = buildQuarantineRecord(source, data.reason, data.raw === undefined ? { items: data.items } : { raw: data.raw }, now);
    try {
      if (!b) throw new Error(this.writeLocked() ? 'Speicher ist für Schreibzugriffe gesperrt' : 'Speicher nicht verfügbar');
      b.setItem(this.prefix + quarantineKey(source, now.getTime()), JSON.stringify(record));
      keysToPrune(Object.keys(this.rawEntries())).forEach((k) => b.removeItem(this.prefix + k));
      return true;
    } catch (e) {
      console.error(`NutriTrack: Quarantäne für "${source}" konnte nicht gesichert werden`, e);
      return false;
    }
  }

  /**
   * Schreib-/Löschschutz: Sind die Rohdaten eines Schlüssels nicht gesichert, wird die Quarantäne erneut versucht.
   * Gelingt sie nicht, wird der Zugriff abgelehnt (Fehler im Banner), damit die Originaldaten nicht verloren gehen.
   */
  private ensureSecured(key: string): boolean {
    const data = this.unsecured.get(key);
    if (!data) return true;
    if (this.writeQuarantine(key, data)) {
      this.setUnsecured(key, null);
      this._notices.update((list) => list.map((n) => (n.key === key ? { ...n, saved: true } : n)));
      this.writeCleaned(key, data);
      if (this.unsecured.size === 0 && this.pending.size === 0) this.markWritten();
      return true;
    }
    this.reportFailure('quota', [key]);
    return false;
  }

  /**
   * Nach nachgeholter Sicherung: schreibt den bereinigten Stand zurück, damit der nächste Start das Verworfene
   * nicht erneut sichert. Ist der Schlüssel noch gesperrt, lehnen `set`/`remove` ab und der Rohwert bleibt.
   */
  private writeCleaned(key: string, data: UnsecuredData): void {
    if (!data.cleaned) return;
    if (data.cleaned.value === null) this.remove(key);
    else this.set(key, data.cleaned.value);
  }

  /** Setzt oder entfernt (`data` = `null`) einen ungesicherten Schlüssel; ohne Schlüssel (`null`) werden alle entfernt. */
  private setUnsecured(key: string | null, data: UnsecuredData | null = null): void {
    if (key === null) this.unsecured.clear();
    else if (data) this.unsecured.set(key, data);
    else this.unsecured.delete(key);
    this._unsecuredKeys.set(new Set(this.unsecured.keys()));
  }

  /** Blendet die Quarantäne-Hinweise aus. */
  dismissQuarantineNotices(): void {
    this._notices.set([]);
  }

  private quarantineRaw(key: string, raw: string): boolean {
    if (this.corruptSeen.get(key) === raw) return false;
    this.corruptSeen.set(key, raw);
    return this.quarantine(key, [], 'parse', raw);
  }

  /** Ein anderes Fenster hat App-Daten geändert: Schreibsperre, damit dessen Stand nicht überschrieben wird. */
  private handleForeignChange(e: StorageEvent): void {
    const isOwnStorage = !e.storageArea || e.storageArea === this.backend();
    const key = e.key === null ? null : e.key.startsWith(this.prefix) ? e.key.slice(this.prefix.length) : undefined;
    if (!isOwnStorage || key === undefined || (key !== null && isQuarantineKey(key))) return;
    if (key !== null && isLockExemptKey(key)) {
      this.noteExemptChange(key);
      return;
    }
    if (key === null) this.pending.clear();
    else this.pending.delete(key);
    this._externalChange.set(true);
  }

  /** Cache/Meta in anderem Fenster: keine Sperre; die Zustimmung gilt dort neu und wird hier neu eingelesen. */
  private noteExemptChange(key: string): void {
    if (isConsentKey(key)) {
      this.pending.delete(key);
      this._consentChanges.update((n) => n + 1);
    }
    this._foreignChange.set({ key, seq: ++this.foreignSeq });
  }

  private reportFailure(kind: StorageErrorKind, keys: readonly string[]): void {
    this._writeFailures.update((n) => n + 1);
    this._lastError.set({ kind, keys, at: Date.now() });
  }

  /** Bewertet das Schema nach einem Löschen/Ersetzen neu: der Speicher hat dann kein neueres Schema mehr. */
  private reevaluateSchema(): void {
    this._schemaNewer.set(readSchemaVersion(this.readParsed(SCHEMA_KEY)) > CURRENT_SCHEMA_VERSION);
    this._externalChange.set(false);
  }

  private markWritten(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.retryIndex = 0;
    // Ein abgelehnter Schreibzugriff auf einen ungesicherten Schlüssel bleibt Fehler, bis die Quarantäne gelingt.
    if (this.unsecured.size === 0) this._lastError.set(null);
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
    this._migrationError.set(null);
    try {
      const from = readSchemaVersion(this.readParsed(SCHEMA_KEY));
      if (from === CURRENT_SCHEMA_VERSION) return;
      const data = this.readStored(false).data;
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
      this._writeFailures.update((n) => n + 1);
      this._migrationError.set({ kind: classifyError(e), keys: [SCHEMA_KEY], at: Date.now() });
    }
  }

  /** Parst alle Einträge; nicht lesbare werden übersprungen und gemeldet. `withQuarantine`: Quarantäne-Schlüssel mitlesen. */
  private readStored(withQuarantine: boolean): SnapshotResult {
    const data: Record<string, unknown> = {};
    const skippedKeys: string[] = [];
    for (const [key, raw] of Object.entries(this.rawEntries())) {
      if (key === SCHEMA_KEY || (!withQuarantine && isQuarantineKey(key))) continue;
      try {
        data[key] = JSON.parse(raw) as unknown;
      } catch {
        if (!isQuarantineKey(key)) skippedKeys.push(key);
      }
    }
    return { data, skippedKeys };
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

  /** @returns `false`, wenn der vorherige Stand nicht (vollständig) wiederhergestellt werden konnte. */
  private restoreRaw(b: Storage, previous: Record<string, string>): boolean {
    try {
      this.writeRaw(b, this.rawEntries(), previous);
      return true;
    } catch (e) {
      console.error('NutriTrack: Wiederherstellung des vorherigen Stands fehlgeschlagen', e);
      return false;
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
