import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BackupService } from '../core/backup/backup.service';
import { describeNotices } from '../core/storage/storage-quarantine';
import { SCHEMA_NEWER_MESSAGE, describeStorageError } from '../core/storage/storage-messages';
import { StorageService } from '../core/storage/storage.service';

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

  readonly busy = signal(false);
  readonly exportError = signal<string | null>(null);

  readonly errorMessage = computed(() => {
    const error = this.storage.lastError();
    if (error) return describeStorageError(error);
    return this.storage.schemaNewer() ? SCHEMA_NEWER_MESSAGE : null;
  });
  readonly hasWriteError = computed(() => this.storage.lastError() !== null);
  readonly noticeMessage = computed(() => describeNotices(this.storage.quarantineNotices()) || null);

  async exportBackup(): Promise<void> {
    this.busy.set(true);
    this.exportError.set(null);
    try {
      await this.backup.exportBackup();
    } catch (e) {
      console.error('NutriTrack: Backup aus dem Fehler-Banner fehlgeschlagen', e);
      this.exportError.set(EXPORT_FAILED_MESSAGE);
    } finally {
      this.busy.set(false);
    }
  }

  retry(): void {
    this.storage.retryNow();
  }

  dismissNotice(): void {
    this.storage.dismissQuarantineNotices();
  }
}
