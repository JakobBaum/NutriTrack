import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { BackupService } from '../core/backup/backup.service';
import { describeNotices } from '../core/storage/storage-quarantine';
import { EXTERNAL_CHANGE_MESSAGE, SCHEMA_NEWER_MESSAGE, describeStorageError } from '../core/storage/storage-messages';
import { StorageService } from '../core/storage/storage.service';
import { exportMessage } from '../settings/backup-messages';
import { OnlineStatusService } from './online-status.service';

const OFFLINE_CLASS = 'nt-offline';
const OFFLINE_OFFSET_VAR = '--nt-offline-offset';

const EXPORT_FAILED_MESSAGE = 'Das Backup konnte nicht erstellt werden. Bitte versuche es erneut.';

/**
 * Dauerhafte Statusleiste oben (kein Toast): Speicherfehler, Daten aus neuerer App-Version
 * und aussortierte Datensätze. Sie verschwindet erst, wenn die Ursache behoben ist (Fehler)
 * bzw. wenn der Hinweis geschlossen wird (aussortierte Daten).
 */
@Component({
  selector: 'app-status-banner',
  templateUrl: './status-banner.component.html',
  styleUrls: ['./status-banner.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBannerComponent {
  private readonly storage = inject(StorageService);
  private readonly backup = inject(BackupService);
  private readonly doc = inject(DOCUMENT);
  private readonly offlineNotice = viewChild<ElementRef<HTMLElement>>('offlineNotice');

  /** Ruhiger Hinweis, solange der Browser offline ist. */
  readonly isOffline = inject(OnlineStatusService).isOffline;

  readonly busy = signal(false);
  readonly exportError = signal<string | null>(null);

  readonly errorMessage = computed(() => {
    const error = this.storage.lastError();
    if (error) return describeStorageError(error);
    if (this.storage.externalChange()) return EXTERNAL_CHANGE_MESSAGE;
    return this.storage.schemaNewer() ? SCHEMA_NEWER_MESSAGE : null;
  });
  /** Auch bei gleichzeitigem Speicherfehler: "Erneut versuchen" kann eine Fremdänderung nicht beheben, nur Neuladen. */
  readonly hasExternalChange = computed(() => this.storage.externalChange());
  readonly hasWriteError = computed(() => this.storage.lastError() !== null);
  /** True, wenn alle aussortierten Daten in die Quarantäne gesichert werden konnten. */
  readonly isNoticeSecured = computed(() => this.storage.quarantineNotices().every((n) => n.saved));
  readonly noticeMessage = computed(() => describeNotices(this.storage.quarantineNotices()) || null);

  constructor() {
    effect((onCleanup) => {
      const el = this.offlineNotice()?.nativeElement;
      if (el) onCleanup(this.reserveSpaceFor(el));
    });
  }

  /**
   * Schiebt die App um die Höhe des Hinweises nach unten, damit er weder Kopfzeile noch Knöpfe verdeckt.
   * Gibt die Aufräumfunktion zurück (Beobachter trennen, Klasse und Maß entfernen).
   */
  private reserveSpaceFor(el: HTMLElement): () => void {
    const root = this.doc.documentElement;
    const apply = (): void => root.style.setProperty(OFFLINE_OFFSET_VAR, `${el.offsetHeight}px`);
    apply();
    root.classList.add(OFFLINE_CLASS);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.classList.remove(OFFLINE_CLASS);
      root.style.removeProperty(OFFLINE_OFFSET_VAR);
    };
  }

  async exportBackup(): Promise<void> {
    this.busy.set(true);
    this.exportError.set(null);
    try {
      const { result, skippedKeys } = await this.backup.exportBackupDetailed();
      const feedback = exportMessage(result, skippedKeys);
      // Gleiche Meldungslogik wie in den Einstellungen; nur Probleme (nicht bestätigt, fehlende Bereiche) erscheinen im Banner.
      if (feedback?.kind === 'alert') this.exportError.set(`${feedback.header}. ${feedback.message}`);
    } catch (e) {
      console.error('NutriTrack: Backup aus dem Fehler-Banner fehlgeschlagen', e);
      this.exportError.set(EXPORT_FAILED_MESSAGE);
    } finally {
      this.busy.set(false);
    }
  }

  reloadApp(): void {
    this.doc.defaultView?.location.reload();
  }

  retry(): void {
    this.storage.retryNow();
  }

  dismissNotice(): void {
    this.storage.dismissQuarantineNotices();
  }
}
