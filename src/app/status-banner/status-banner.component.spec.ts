import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { BackupService } from '../core/backup/backup.service';
import { StorageService } from '../core/storage/storage.service';
import { StatusBannerComponent } from './status-banner.component';

function failingStorage(): void {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError');
    },
    removeItem: () => undefined,
    key: () => null,
    length: 0,
  });
}

describe('StatusBannerComponent', () => {
  const exportBackup = vi.fn();

  beforeEach(async () => {
    exportBackup.mockReset().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      declarations: [StatusBannerComponent],
      providers: [{ provide: BackupService, useValue: { exportBackup } }],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('zeigt ohne Probleme nichts an', () => {
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.banner')).toBeNull();
  });

  it('zeigt bei Speicherfehler ein Banner mit role=alert und Backup-Hinweis', () => {
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    failingStorage();
    storage.set('diary', []);
    storage.flush();
    fixture.detectChanges();

    const banner: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Backup');
  });

  it('exportiert per Button ein Backup', async () => {
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    failingStorage();
    storage.set('diary', []);
    storage.flush();
    fixture.detectChanges();

    await fixture.componentInstance.exportBackup();
    expect(exportBackup).toHaveBeenCalledTimes(1);
  });

  it('zeigt eine Fehlermeldung, wenn der Export scheitert', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exportBackup.mockRejectedValue(new Error('x'));
    const fixture = TestBed.createComponent(StatusBannerComponent);
    await fixture.componentInstance.exportBackup();
    expect(fixture.componentInstance.exportError()).toContain('nicht erstellt');
    expect(errSpy).toHaveBeenCalled();
  });

  it('erneuter Versuch ruft retryNow auf', () => {
    const storage = TestBed.inject(StorageService);
    const spy = vi.spyOn(storage, 'retryNow');
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.componentInstance.retry();
    expect(spy).toHaveBeenCalled();
  });

  
  it('zeigt aussortierte Datensaetze als schliessbaren Hinweis', () => {
    const storage = TestBed.inject(StorageService);
    storage.quarantine('diary', [{ bad: true }], 'invalid');
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="quarantine-banner"]')).not.toBeNull();

    fixture.componentInstance.dismissNotice();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="quarantine-banner"]')).toBeNull();
  });
});
