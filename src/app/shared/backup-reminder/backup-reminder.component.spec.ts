import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { BackupService } from '../../core/backup/backup.service';
import { REMINDER_SNOOZE_KEY } from '../../core/backup/backup';
import { DiaryStore } from '../../core/state/diary.store';
import { StorageService } from '../../core/storage/storage.service';
import { NtBackupReminderComponent } from './backup-reminder.component';

const DAY = 86_400_000;

describe('NtBackupReminderComponent', () => {
  const exportBackup = vi.fn();

  function setup(entryAgeDays: number | null) {
    const entries = entryAgeDays === null ? [] : [{ createdAt: new Date(Date.now() - entryAgeDays * DAY).toISOString() }];
    TestBed.configureTestingModule({
      declarations: [NtBackupReminderComponent],
      providers: [
        { provide: BackupService, useValue: { lastBackup: () => null, exportBackup } },
        { provide: DiaryStore, useValue: { entries: () => entries } },
      ],
    });
    const fixture = TestBed.createComponent(NtBackupReminderComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    exportBackup.mockReset().mockResolvedValue(undefined);
    localStorage.clear();
  });

  it('zeigt nichts ohne Einträge', () => {
    expect(setup(null).nativeElement.querySelector('[data-testid="backup-reminder"]')).toBeNull();
  });

  it('zeigt den Hinweis bei alten, ungesicherten Einträgen', () => {
    expect(setup(10).nativeElement.querySelector('[data-testid="backup-reminder"]')).not.toBeNull();
  });

  it('blendet bei "Später" aus und merkt sich das im Speicher', () => {
    const fixture = setup(10);
    fixture.componentInstance.later();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="backup-reminder"]')).toBeNull();
    expect(TestBed.inject(StorageService).get<string | null>(REMINDER_SNOOZE_KEY, null)).not.toBeNull();
  });

  it('startet bei "Jetzt sichern" den Export', async () => {
    const fixture = setup(10);
    await fixture.componentInstance.backupNow();
    expect(exportBackup).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.error()).toBeNull();
  });

  it('meldet einen fehlgeschlagenen Export sichtbar', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exportBackup.mockRejectedValue(new Error('x'));
    const fixture = setup(10);
    await fixture.componentInstance.backupNow();
    expect(fixture.componentInstance.error()).toContain('nicht erstellt');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
