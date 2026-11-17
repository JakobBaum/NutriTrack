import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { BackupService } from '../core/backup/backup.service';
import { EXTERNAL_CHANGE_MESSAGE } from '../core/storage/storage-messages';
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
  const exportDetailed = vi.fn();


  beforeEach(async () => {
    exportDetailed.mockReset().mockResolvedValue({ result: 'shared', skippedKeys: [] });
    await TestBed.configureTestingModule({
      declarations: [StatusBannerComponent],
      providers: [{ provide: BackupService, useValue: { exportBackupDetailed: exportDetailed } }],
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
    expect(exportDetailed).toHaveBeenCalledTimes(1);
  });

  it('zeigt eine Fehlermeldung, wenn der Export scheitert', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exportDetailed.mockRejectedValue(new Error('x'));
    const fixture = TestBed.createComponent(StatusBannerComponent);
    await fixture.componentInstance.exportBackup();
    expect(fixture.componentInstance.exportError()).toContain('nicht erstellt');
    expect(errSpy).toHaveBeenCalled();
  });

  it('meldet im Banner, wenn der Export nicht bestätigt werden konnte', async () => {
    exportDetailed.mockResolvedValue({ result: 'unverified', skippedKeys: [] });
    const fixture = TestBed.createComponent(StatusBannerComponent);
    await fixture.componentInstance.exportBackup();
    expect(fixture.componentInstance.exportError()).toContain('Teilen-Menü');
  });

  it('zeigt nach erfolgreichem Export keine Fehlermeldung', async () => {
    exportDetailed.mockResolvedValue({ result: 'shared', skippedKeys: [] });
    const fixture = TestBed.createComponent(StatusBannerComponent);
    await fixture.componentInstance.exportBackup();
    expect(fixture.componentInstance.exportError()).toBeNull();
  });

  it('nennt fehlende Bereiche, wenn das Backup unvollständig ist', async () => {
    exportDetailed.mockResolvedValue({ result: 'shared', skippedKeys: ['diary'] });
    const fixture = TestBed.createComponent(StatusBannerComponent);
    await fixture.componentInstance.exportBackup();
    expect(fixture.componentInstance.exportError()).toContain('unvollständig');
    expect(fixture.componentInstance.exportError()).toContain('Tagebuch');
  });

  it('zeigt bei Änderung in einem anderen Fenster eine Meldung mit Neu-laden-Aktion', () => {
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    const reload = vi.spyOn(fixture.componentInstance, 'reloadApp').mockImplementation(() => undefined);
    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));
    expect(storage.externalChange()).toBe(true);
    fixture.detectChanges();

    const banner: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner.textContent).toContain(EXTERNAL_CHANGE_MESSAGE);
    fixture.nativeElement.querySelector('[data-testid="reload-btn"]').click();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('zeigt "Neu laden" auch dann, wenn zugleich ein Speicherfehler besteht', () => {
    failingStorage();
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]' }));
    expect(storage.lastError()).not.toBeNull();
    expect(storage.externalChange()).toBe(true);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="reload-btn"]')).not.toBeNull();
    expect(root.textContent).toContain('Erneut versuchen');
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

  it('behauptet die Sicherung nur, wenn alle Hinweise gesichert sind', () => {
    const storage = TestBed.inject(StorageService);
    storage.quarantine('diary', [{ bad: true }], 'invalid');
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    const text = (): string => fixture.nativeElement.querySelector('[data-testid="quarantine-banner"]').textContent;
    expect(text()).toContain('Die Originale liegen gesichert im Gerätespeicher.');
    expect(text()).not.toContain('Nicht gesichert');
  });

  it('warnt bei gescheiterter Quarantäne statt Sicherung zu behaupten, mit Backup-Export', () => {
    const storage = TestBed.inject(StorageService);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    failingStorage();
    storage.quarantine('diary', [{ bad: true }], 'invalid');
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    const banner: HTMLElement = fixture.nativeElement.querySelector('[data-testid="quarantine-banner"]');
    expect(banner.textContent).not.toContain('gesichert im Gerätespeicher');
    expect(banner.textContent).toContain('Nicht gesichert. Exportiere ein Backup und gib Speicher frei.');
    expect(banner.textContent).toContain('Backup exportieren');
  });
});

describe('StatusBannerComponent Offline-Hinweis', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusBannerComponent],
      providers: [{ provide: BackupService, useValue: { exportBackupDetailed: vi.fn() } }],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  const notice = (root: HTMLElement): HTMLElement | null => root.querySelector('[data-testid="offline-banner"]');

  it('zeigt online keinen Hinweis', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    expect(notice(fixture.nativeElement)).toBeNull();
  });

  it('zeigt offline den ruhigen Hinweis mit role=status und aria-live=polite', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    const el = notice(fixture.nativeElement);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-live')).toBe('polite');
    expect(el?.textContent).toContain('Offline. KI und Online-Suche sind gerade nicht verfügbar, dein Tagebuch funktioniert weiter.');
  });

  it('blendet den Hinweis bei online-Ereignis wieder aus', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fixture = TestBed.createComponent(StatusBannerComponent);
    fixture.detectChanges();
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(notice(fixture.nativeElement)).toBeNull();
  });
});
