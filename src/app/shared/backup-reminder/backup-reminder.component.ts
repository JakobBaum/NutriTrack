import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BackupService } from '../../core/backup/backup.service';
import { REMINDER_SNOOZE_KEY } from '../../core/backup/backup';
import { needsBackupReminder, snoozeUntil } from '../../core/backup/backup-reminder';
import { DiaryStore } from '../../core/state/diary.store';
import { StoragePersistenceService } from '../../core/storage/storage-persistence.service';
import { StorageService } from '../../core/storage/storage.service';

const EXPORT_FAILED_MESSAGE = 'Das Backup konnte nicht erstellt werden. Bitte versuche es erneut.';

/** Dezenter Hinweis auf dem Dashboard, wenn seit längerem kein Backup mehr gemacht wurde. */
@Component({
  selector: 'nt-backup-reminder',
  templateUrl: './backup-reminder.component.html',
  styleUrls: ['./backup-reminder.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtBackupReminderComponent {
  private readonly storage = inject(StorageService);
  private readonly backup = inject(BackupService);
  private readonly diary = inject(DiaryStore);
  private readonly persistence = inject(StoragePersistenceService);

  private readonly snoozedUntil = signal<string | null>(this.storage.get<string | null>(REMINDER_SNOOZE_KEY, null));

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly persistDenied = this.persistence.denied;

  readonly due = computed(() =>
    needsBackupReminder({
      now: Date.now(),
      lastBackup: this.backup.lastBackup(),
      entryDates: this.diary.entries().map((e) => e.createdAt),
      snoozedUntil: this.snoozedUntil(),
    }),
  );

  async backupNow(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.backup.exportBackup();
    } catch (e) {
      console.error('NutriTrack: Backup-Erinnerung konnte nicht exportieren', e);
      this.error.set(EXPORT_FAILED_MESSAGE);
    } finally {
      this.busy.set(false);
    }
  }

  later(): void {
    const until = snoozeUntil(Date.now());
    this.storage.set(REMINDER_SNOOZE_KEY, until);
    this.snoozedUntil.set(until);
  }
}
