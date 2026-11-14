import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { CONSENT_KEY } from '../consent/consent.model';
import { StorageService } from '../storage/storage.service';
import {
  AUTO_SNAPSHOT_KEY,
  BACKUP_ERRORS,
  BackupCleanup,
  BackupFile,
  BackupParseResult,
  LAST_BACKUP_KEY,
  MAX_BACKUP_BYTES,
  backupFileName,
  buildBackup,
  parseBackup,
  prepareRestore,
  serializeBackup,
} from './backup';
import { SafetyReason, SafetySnapshot, buildSafetySnapshot, readSafetySnapshot } from './backup-safety';

/** Wie das Backup ausgeliefert wurde. */
export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/** Ergebnis von `restore`: ob ersetzt wurde und ob dabei die Auto-Sicherung des alten Stands entstand. */
export interface RestoreResult {
  readonly ok: boolean;
  readonly safetySaved: boolean;
}

const JSON_MIME = 'application/json';
/** Verzögerung, bis die Objekt-URL freigegeben wird (Safari braucht sie kurz nach dem Klick noch). */
const REVOKE_DELAY_MS = 1000;

type Data = Readonly<Record<string, unknown>>;

/**
 * Browser-seitiger Teil des Backups: Datei teilen/herunterladen, Datei lesen,
 * Daten ersetzen, Auto-Sicherung. Die Prüflogik liegt in den reinen Funktionen aus `backup.ts`.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly storage = inject(StorageService);
  private readonly doc = inject(DOCUMENT);

  private readonly _lastBackup = signal<string | null>(this.storage.get<string | null>(LAST_BACKUP_KEY, null));
  /** ISO-Zeitpunkt des letzten erfolgreichen Exports auf diesem Gerät. */
  readonly lastBackup = this._lastBackup.asReadonly();

  /** Erstellt das Backup und teilt es (iOS/Web Share) oder lädt es herunter. */
  async exportBackup(now: Date = new Date()): Promise<ExportResult> {
    const backup = buildBackup(this.storage.snapshot(), now);
    const name = backupFileName(now);
    const blob = new Blob([serializeBackup(backup)], { type: JSON_MIME });
    const result = await this.deliver(blob, name);
    if (result !== 'cancelled') this.markBackup(backup.exportedAt);
    return result;
  }

  /** Liest und prüft eine ausgewählte Datei. Wirft nie. */
  async readFile(file: File): Promise<BackupParseResult> {
    if (file.size > MAX_BACKUP_BYTES) return { ok: false, error: BACKUP_ERRORS.tooLarge };
    try {
      return parseBackup(await file.text());
    } catch {
      return { ok: false, error: BACKUP_ERRORS.notJson };
    }
  }

  /**
   * Ersetzt alle lokalen Daten durch das Backup. Vorher entsteht eine Auto-Sicherung des alten Stands
   * (reicht der Speicher dafür nicht, wird ohne sie importiert und das im Ergebnis gemeldet).
   * Das Datum des letzten Exports bleibt erhalten; aussortierte Datensätze (`cleanup`) landen in der Quarantäne.
   */
  restore(backup: BackupFile, cleanup?: BackupCleanup, reason: SafetyReason = 'import'): RestoreResult {
    const current = this.storage.snapshot();
    const safety = buildSafetySnapshot(current, reason, new Date());
    const base = this.keepMeta(prepareRestore(backup.data), current);
    const withSafety = safety ? { ...base, [AUTO_SNAPSHOT_KEY]: safety } : base;
    let safetySaved = safety !== null;
    let ok = this.storage.replaceAll(withSafety);
    if (!ok && safety) {
      safetySaved = false;
      ok = this.storage.replaceAll(base);
    }
    if (ok && cleanup) this.quarantineCleanup(cleanup);
    return { ok, safetySaved };
  }

  /** Auto-Sicherung (falls vorhanden und lesbar), ohne die Daten zu verändern. */
  readSafetySnapshot(): SafetySnapshot | null {
    return readSafetySnapshot(this.storage.get<unknown>(AUTO_SNAPSHOT_KEY, null));
  }

  /** Stellt die Auto-Sicherung wieder her (der aktuelle Stand wird dabei selbst zur neuen Auto-Sicherung). */
  restoreSafetySnapshot(): RestoreResult {
    const snapshot = this.readSafetySnapshot();
    if (!snapshot) return { ok: false, safetySaved: false };
    return this.restore(snapshot.backup, undefined, 'restore');
  }

  /** Löscht die Auto-Sicherung endgültig. */
  discardSafetySnapshot(): void {
    this.storage.remove(AUTO_SNAPSHOT_KEY);
  }

  /** Auto-Sicherung des aktuellen Stands vor dem Zurücksetzen (`null`, wenn es nichts zu sichern gibt). */
  takeResetSnapshot(now: Date = new Date()): SafetySnapshot | null {
    return buildSafetySnapshot(this.storage.snapshot(), 'reset', now);
  }

  /**
   * Löscht alle lokalen Daten, setzt das Backup-Datum zurück und legt danach die Auto-Sicherung ab.
   * @returns `true`, wenn die Auto-Sicherung geschrieben wurde (oder nichts zu sichern war).
   */
  completeReset(safety: SafetySnapshot | null): boolean {
    this.storage.clearAll();
    this._lastBackup.set(null);
    if (!safety) return true;
    this.storage.set(AUTO_SNAPSHOT_KEY, safety);
    return this.storage.flush();
  }

  /** Meta-Schlüssel, die ein Import nicht überschreiben soll: Datum des letzten Exports, bestehende Auto-Sicherung und die Zustimmung dieses Geräts. */
  private keepMeta(data: Data, current: Data): Record<string, unknown> {
    const last = this._lastBackup();
    const existing = current[AUTO_SNAPSHOT_KEY];
    const consent = current[CONSENT_KEY];
    return {
      ...data,
      ...(last ? { [LAST_BACKUP_KEY]: last } : {}),
      ...(existing !== undefined ? { [AUTO_SNAPSHOT_KEY]: existing } : {}),
      ...(consent !== undefined ? { [CONSENT_KEY]: consent } : {}),
    };
  }

  private quarantineCleanup(cleanup: BackupCleanup): void {
    Object.entries(cleanup.quarantined).forEach(([key, items]) => this.storage.quarantine(key, items, 'invalid'));
  }

  private markBackup(iso: string): void {
    this._lastBackup.set(iso);
    this.storage.set(LAST_BACKUP_KEY, iso);
  }

  private async deliver(blob: Blob, name: string): Promise<ExportResult> {
    const nav = this.doc.defaultView?.navigator;
    const file = new File([blob], name, { type: JSON_MIME });
    const shareData: ShareData = { files: [file], title: name };
    if (nav?.share && nav.canShare?.(shareData)) {
      try {
        await nav.share(shareData);
        return 'shared';
      } catch (e) {
        // Nutzer hat das Teilen-Menü geschlossen: kein Fehler, kein Fallback.
        if ((e as Error)?.name === 'AbortError') return 'cancelled';
      }
    }
    this.download(blob, name);
    return 'downloaded';
  }

  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    this.doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}
