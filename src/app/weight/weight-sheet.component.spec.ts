import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { WeightStore } from '../core/state/weight.store';
import { WeightSheetComponent } from './weight-sheet.component';

function lockStorage(): void {
  window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));
}

describe('WeightSheetComponent Speichern', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ declarations: [WeightSheetComponent], schemas: [CUSTOM_ELEMENTS_SCHEMA] });
    TestBed.overrideComponent(WeightSheetComponent, { set: { template: '' } });
  });

  it('speichert und schließt bei freiem Speicher', () => {
    const sheet = TestBed.createComponent(WeightSheetComponent).componentInstance;
    let closed = 0;
    sheet.closed.subscribe(() => closed++);
    sheet.setDraft(80);
    sheet.save();
    expect(TestBed.inject(WeightStore).latest()?.kg).toBe(80);
    expect(closed).toBe(1);
    expect(sheet.saveError()).toBeNull();
  });

  it('zeigt bei ungültigem Wert die Eingabe-Fehlermeldung statt der Schreibsperre und bleibt offen', () => {
    const sheet = TestBed.createComponent(WeightSheetComponent).componentInstance;
    let closed = 0;
    sheet.closed.subscribe(() => closed++);
    sheet.setDraft(5);
    sheet.save();
    expect(closed).toBe(0);
    expect(sheet.saveError()).toBe('Bitte gib ein Gewicht zwischen 20 und 400 kg ein.');
  });

  it('schließt bei Schreibsperre nicht, speichert nichts und zeigt den Fehler', () => {
    const sheet = TestBed.createComponent(WeightSheetComponent).componentInstance;
    let closed = 0;
    sheet.closed.subscribe(() => closed++);
    lockStorage();
    sheet.setDraft(80);
    sheet.save();
    expect(TestBed.inject(WeightStore).latest()).toBeNull();
    expect(closed).toBe(0);
    expect(sheet.saveError()).toBe(WRITE_BLOCKED_MESSAGE);
  });
});
