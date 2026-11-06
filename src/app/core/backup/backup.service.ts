import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import {
  BACKUP_ERRORS,
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

/** Wie das Backup ausgeliefert wurde. */
export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

const JSON_MIME = 'application/json';
/** Verzögerung, bis die Objekt-URL freigegeben wird (Safari braucht sie kurz nach dem Klick noch). */
const REVOKE_DELAY_MS = 1000;

/**
 * Browser-seitiger Teil des Backups: Datei teilen/herunterladen, Datei lesen,
 * Daten ersetzen. Die Prüflogik liegt in den reinen Funktionen aus `backup.ts`.
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

  /** Ersetzt alle lokalen Daten durch das Backup. Das Datum des letzten Exports bleibt erhalten. */
  restore(backup: BackupFile): boolean {
    const data = prepareRestore(backup.data, this.storage.snapshot());
    const last = this._lastBackup();
    const merged = last ? { ...data, [LAST_BACKUP_KEY]: last } : data;
    return this.storage.replaceAll(merged);
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
