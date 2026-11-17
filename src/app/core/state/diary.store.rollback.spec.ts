import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DiaryStore, NewDiaryEntry } from './diary.store';
import { StorageService } from '../storage/storage.service';
import { NutritionFacts } from '../models';

const facts: NutritionFacts = { kcal: 200, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
const input: NewDiaryEntry = { dateISO: '2026-11-08', meal: 'lunch', label: 'Reis', facts };

describe('DiaryStore Rückrollen bei fehlgeschlagenem Speichern', () => {
  let store: DiaryStore;
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    storage = TestBed.inject(StorageService);
    store = TestBed.inject(DiaryStore);
  });

  it('tryAdd liefert den Eintrag, wenn gespeichert wurde', () => {
    expect(store.tryAdd(input)?.label).toBe('Reis');
    expect(store.entries()).toHaveLength(1);
  });

  it('tryAdd rollt zurück und liefert null, wenn das Speichern scheitert', () => {
    vi.spyOn(storage, 'set').mockReturnValue(false);
    expect(store.tryAdd(input)).toBeNull();
    expect(store.entries()).toHaveLength(0);
  });

  it('update rollt zurück und liefert false, wenn das Speichern scheitert', () => {
    const entry = store.tryAdd(input)!;
    vi.spyOn(storage, 'set').mockReturnValue(false);
    expect(store.update(entry.id, { label: 'Nudeln' })).toBe(false);
    expect(store.entries()[0].label).toBe('Reis');
  });

  it('update liefert true bei Erfolg', () => {
    const entry = store.tryAdd(input)!;
    expect(store.update(entry.id, { label: 'Nudeln' })).toBe(true);
    expect(store.entries()[0].label).toBe('Nudeln');
  });

  it('remove rollt zurück und liefert false, wenn das Speichern scheitert', () => {
    const entry = store.tryAdd(input)!;
    vi.spyOn(storage, 'set').mockReturnValue(false);
    expect(store.remove(entry.id)).toBe(false);
    expect(store.entries()).toHaveLength(1);
  });

  it('isReadOnly ist true, solange der Schlüssel ungesichert ist', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.includes('quarantine.')) throw new DOMException('voll', 'QuotaExceededError');
      realSet.call(this, k, v);
    });
    storage.quarantine('diary', [{ bad: 1 }], 'invalid');
    expect(store.isReadOnly()).toBe(true);
    expect(store.tryAdd(input)).toBeNull();
  });
});
