import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup } from '../backup/backup';
import { StorageService } from '../storage/storage.service';
import { AppSettingsStore } from './app-settings.store';

describe('AppSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('startet metrisch und mit Sprache de', () => {
    const store = TestBed.inject(AppSettingsStore);
    expect(store.unitSystem()).toBe('metric');
    expect(store.appLanguage).toBe('de');
  });

  it('speichert das Einheitensystem und lädt es neu', () => {
    TestBed.inject(AppSettingsStore).setUnitSystem('imperial');
    TestBed.resetTestingModule();
    expect(TestBed.inject(AppSettingsStore).unitSystem()).toBe('imperial');
  });

  it('ignoriert ungültige gespeicherte Werte', () => {
    TestBed.inject(StorageService).set('app-settings', { unitSystem: 'furlong' });
    TestBed.resetTestingModule();
    expect(TestBed.inject(AppSettingsStore).unitSystem()).toBe('metric');
  });

  it('setzt beim Zurücksetzen auf metrisch', () => {
    const store = TestBed.inject(AppSettingsStore);
    store.setUnitSystem('imperial');
    store.clear();
    expect(store.unitSystem()).toBe('metric');
  });

  it('ist im Backup enthalten', () => {
    TestBed.inject(AppSettingsStore).setUnitSystem('imperial');
    const snapshot = TestBed.inject(StorageService).snapshot();
    const backup = buildBackup(snapshot, new Date());
    expect(backup.data['app-settings']).toEqual({ unitSystem: 'imperial' });
  });

  it('lässt den Übersetzungs-Cache aus dem Backup', () => {
    const backup = buildBackup({ translations: { x: 1 }, 'app-settings': { unitSystem: 'metric' } }, new Date());
    expect(Object.keys(backup.data)).toEqual(['app-settings']);
  });
});
