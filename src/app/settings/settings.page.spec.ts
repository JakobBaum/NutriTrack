import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupService } from '../core/backup/backup.service';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { SettingsPage } from './settings.page';

describe('SettingsPage Backup-Import', () => {
  const create = vi.fn();
  const readFile = vi.fn();

  beforeEach(() => {
    create.mockReset().mockResolvedValue({ present: async () => undefined });
    readFile.mockReset();
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [SettingsPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: AlertController, useValue: { create } },
      ],
    });
    TestBed.overrideComponent(SettingsPage, { set: { template: '' } });
    const backup = TestBed.inject(BackupService);
    vi.spyOn(backup, 'readFile').mockImplementation(readFile);
  });

  it('meldet einen Fehler beim Lesen der Datei, statt still zu scheitern', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    readFile.mockRejectedValue(new Error('kaputt'));
    const page = TestBed.createComponent(SettingsPage).componentInstance;
    const input = { files: [new File(['{}'], 'b.json')], value: 'x' } as unknown as HTMLInputElement;

    await page.onBackupFileSelected({ target: input } as unknown as Event);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ header: 'Backup kann nicht gelesen werden' }));
    expect(page.backupBusy()).toBe(false);
  });
});

describe('SettingsPage Export und Schreibsperre', () => {
  const create = vi.fn();
  const lock = (): void => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));
  };

  beforeEach(() => {
    create.mockReset().mockResolvedValue({ present: async () => undefined });
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [SettingsPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [provideHttpClient(), provideRouter([]), { provide: AlertController, useValue: { create } }],
    });
    TestBed.overrideComponent(SettingsPage, { set: { template: '' } });
  });

  it('meldet nicht lesbare Bereiche mit lesbaren Namen, obwohl der Export gelang', async () => {
    vi.spyOn(TestBed.inject(BackupService), 'exportBackupDetailed').mockResolvedValue({ result: 'shared', skippedKeys: ['diary'] });
    const page = TestBed.createComponent(SettingsPage).componentInstance;

    await page.exportBackup();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ header: 'Backup unvollständig', message: expect.stringContaining('Tagebuch') }));
    expect(page.savedToast()).toBeNull();
  });

  it('fragt nach fehlgeschlagenem Backup vor dem Zurücksetzen ausdrücklich, ohne Alerts zu stapeln (S4)', async () => {
    vi.spyOn(TestBed.inject(BackupService), 'exportBackupDetailed').mockResolvedValue({ result: 'unverified', skippedKeys: [] });
    const page = TestBed.createComponent(SettingsPage).componentInstance;
    await page.confirmReset();
    const resetOptions = create.mock.calls[0][0] as { buttons: { text: string; handler?: () => void }[] };
    create.mockClear();

    resetOptions.buttons.find((b) => b.text === 'Backup zuerst')?.handler?.();
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));

    const options = create.mock.calls[0][0] as { header: string; message: string; buttons: { text: string; handler?: () => void }[] };
    expect(options.header).toBe('Backup fehlgeschlagen');
    expect(options.message).toContain('Trotzdem fortfahren?');
    options.buttons.find((b) => b.text === 'Fortfahren')?.handler?.();
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1][0]).toMatchObject({ header: 'Alle Daten zurücksetzen?' });
  });

  it('zeigt bei vollständigem Export weiter den Erfolgs-Toast', async () => {
    vi.spyOn(TestBed.inject(BackupService), 'exportBackupDetailed').mockResolvedValue({ result: 'shared', skippedKeys: [] });
    const page = TestBed.createComponent(SettingsPage).componentInstance;

    await page.exportBackup();

    expect(page.savedToast()).toBe('Backup erstellt.');
    expect(create).not.toHaveBeenCalled();
  });

  it('löscht die Auto-Sicherung bei Schreibsperre nicht und meldet keinen Erfolg', async () => {
    const backup = TestBed.inject(BackupService);
    const discard = vi.spyOn(backup, 'discardSafetySnapshot');
    const page = TestBed.createComponent(SettingsPage).componentInstance;
    lock();

    await page.discardSafety();

    expect(discard).not.toHaveBeenCalled();
    expect(page.savedToast()).toBeNull();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ message: WRITE_BLOCKED_MESSAGE }));
  });

  it('widerruft die Zustimmung bei Schreibsperre nicht mit Erfolgsmeldung', async () => {
    const page = TestBed.createComponent(SettingsPage).componentInstance;
    lock();

    await page.revokeConsent();

    expect(page.savedToast()).toBeNull();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ message: WRITE_BLOCKED_MESSAGE }));
  });
});
