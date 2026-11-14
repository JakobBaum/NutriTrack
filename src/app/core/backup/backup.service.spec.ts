import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';
import { StorageService } from '../storage/storage.service';
import { BackupFile, validateBackup } from './backup';

const facts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
const entry = (id: string, label = 'Reis') => ({
  id, dateISO: '2026-11-08', meal: 'lunch', label, ref: { kind: 'manual' }, facts, createdAt: '2026-11-08T10:00:00.000Z',
});

function backupWith(diary: unknown[]): BackupFile {
  const parsed = validateBackup({ format: 'nutritrack-backup', version: 1, exportedAt: '2026-11-01T10:00:00.000Z', data: { diary } });
  if (!parsed.ok) throw new Error('Testdaten ungültig');
  return parsed.backup;
}

const stored = (key: string): unknown => JSON.parse(localStorage.getItem(`nutritrack:${key}`) ?? 'null');

let service: BackupService;
let storage: StorageService;

function setup(initial: Record<string, unknown> = {}): void {
  localStorage.clear();
  Object.entries(initial).forEach(([k, v]) => localStorage.setItem(`nutritrack:${k}`, JSON.stringify(v)));
  TestBed.resetTestingModule();
  service = TestBed.inject(BackupService);
  storage = TestBed.inject(StorageService);
}

describe('BackupService Auto-Sicherung (Welle A, Punkt 4)', () => {
  beforeEach(() => setup({ diary: [entry('alt')], lastBackup: '2026-10-01T10:00:00.000Z' }));

  it('restore legt vor dem Ersetzen eine Auto-Sicherung des alten Stands ab', () => {
    const result = service.restore(backupWith([entry('neu')]));
    expect(result).toEqual({ ok: true, safetySaved: true });
    expect((stored('diary') as Array<{ id: string }>)[0].id).toBe('neu');
    const snapshot = service.readSafetySnapshot();
    expect(snapshot?.reason).toBe('import');
    expect((snapshot?.backup.data['diary'] as Array<{ id: string }>)[0].id).toBe('alt');
  });

  it('behält das Datum des letzten Backups über den Import hinweg', () => {
    service.restore(backupWith([entry('neu')]));
    expect(stored('lastBackup')).toBe('2026-10-01T10:00:00.000Z');
  });

  it('importiert ohne Auto-Sicherung, wenn der Speicher dafür nicht reicht, und meldet das', () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
      if (key.includes('autosnapshot')) throw new DOMException('voll', 'QuotaExceededError');
      real.call(this, key, value);
    };
    try {
      const result = service.restore(backupWith([entry('neu')]));
      expect(result).toEqual({ ok: true, safetySaved: false });
      expect((stored('diary') as Array<{ id: string }>)[0].id).toBe('neu');
    } finally {
      Storage.prototype.setItem = real;
    }
  });

  it('schreibt aussortierte Datensätze eines Imports in die Quarantäne', () => {
    const cleanup = { repaired: 0, skipped: 1, quarantined: { diary: [{ id: 'kaputt' }] } };
    service.restore(backupWith([entry('neu')]), cleanup);
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('nutritrack:quarantine.diary.'));
    expect(keys).toHaveLength(1);
  });

  it('stellt die Auto-Sicherung wieder her und sichert dabei den aktuellen Stand', () => {
    service.restore(backupWith([entry('neu')]));
    const result = service.restoreSafetySnapshot();
    expect(result.ok).toBe(true);
    expect((stored('diary') as Array<{ id: string }>)[0].id).toBe('alt');
    expect((service.readSafetySnapshot()?.backup.data['diary'] as Array<{ id: string }>)[0].id).toBe('neu');
    expect(service.readSafetySnapshot()?.reason).toBe('restore');
  });

  it('discardSafetySnapshot löscht die Auto-Sicherung', () => {
    service.restore(backupWith([entry('neu')]));
    service.discardSafetySnapshot();
    expect(service.readSafetySnapshot()).toBeNull();
  });

  it('exportiert die Auto-Sicherung nicht mit', async () => {
    service.restore(backupWith([entry('neu')]));
    expect(Object.keys(storage.snapshot())).toContain('autosnapshot');
    // buildBackup filtert Geräte-Schlüssel (siehe backup.spec); hier nur: Snapshot ist nicht selbst Teil der Sicherung.
    expect(Object.keys(service.readSafetySnapshot()?.backup.data ?? {})).not.toContain('autosnapshot');
  });

  it('liefert keine Auto-Sicherung, wenn keine existiert oder der Wert ungültig ist', () => {
    setup({ autosnapshot: { kaputt: true } });
    expect(service.readSafetySnapshot()).toBeNull();
  });
});

describe('BackupService und Zustimmung', () => {
  const consent = { version: 1, acceptedAt: '2026-11-10T10:00:00.000Z', isAdultConfirmed: true };

  it('behält die Zustimmung dieses Geräts über einen Import hinweg', () => {
    setup({ diary: [entry('alt')], consent });
    service.restore(backupWith([entry('neu')]));
    expect(stored('consent')).toEqual(consent);
  });

  it('übernimmt keine Zustimmung aus der Backup-Datei', () => {
    setup({ diary: [entry('alt')] });
    const parsed = validateBackup({ format: 'nutritrack-backup', version: 1, exportedAt: '2026-11-01T10:00:00.000Z', data: { diary: [], consent } });
    if (!parsed.ok) throw new Error('Testdaten ungültig');
    service.restore(parsed.backup);
    expect(stored('consent')).toBeNull();
  });
});

describe('BackupService Reset (Welle A, Punkt 4)', () => {
  beforeEach(() => setup({ diary: [entry('alt')], lastBackup: '2026-10-01T10:00:00.000Z' }));

  it('setzt das Backup-Datum zurück und behält eine Auto-Sicherung', () => {
    expect(service.lastBackup()).toBe('2026-10-01T10:00:00.000Z');
    const safety = service.takeResetSnapshot();
    expect(safety?.reason).toBe('reset');
    expect(service.completeReset(safety)).toBe(true);
    expect(service.lastBackup()).toBeNull();
    expect(stored('lastBackup')).toBeNull();
    expect(stored('diary')).toBeNull();
    expect((service.readSafetySnapshot()?.backup.data['diary'] as Array<{ id: string }>)[0].id).toBe('alt');
  });

  it('legt ohne Daten keine leere Auto-Sicherung an', () => {
    setup({});
    expect(service.takeResetSnapshot()).toBeNull();
    expect(service.completeReset(null)).toBe(true);
    expect(service.readSafetySnapshot()).toBeNull();
  });

  it('löscht Quarantäne beim Reset', () => {
    storage.quarantine('diary', [1], 'invalid');
    service.completeReset(service.takeResetSnapshot());
    expect(Object.keys(localStorage).some((k) => k.includes('quarantine.'))).toBe(false);
  });
});
