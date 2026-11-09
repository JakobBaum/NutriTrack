import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DiaryStore } from './diary.store';
import { StorageService } from '../storage/storage.service';
import { toDateISO } from '../util/date';

const facts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
const good = {
  id: 'g1', dateISO: '2026-11-08', meal: 'lunch', label: 'Reis', ref: { kind: 'manual' }, facts, createdAt: '2026-11-08T10:00:00.000Z',
};

function createStore(stored: unknown): { store: DiaryStore; storage: StorageService } {
  localStorage.clear();
  localStorage.setItem('nutritrack:diary', JSON.stringify(stored));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  return { store: TestBed.inject(DiaryStore), storage: TestBed.inject(StorageService) };
}

describe('DiaryStore Laden mit defekten Daten (Welle A, Punkt 3)', () => {
  beforeEach(() => localStorage.clear());

  it('stürzt mit fehlendem createdAt nicht ab und liefert den Eintrag sortiert', () => {
    const { createdAt: _drop, ...broken } = good;
    const { store } = createStore([{ ...broken, id: 'b1' }, good]);
    expect(() => store.entriesForDate('2026-11-08')).not.toThrow();
    expect(store.entriesForDate('2026-11-08')).toHaveLength(2);
    expect(() => store.recentFoods()).not.toThrow();
  });

  it('legt unreparierbare Einträge in Quarantäne und meldet einen Hinweis', () => {
    const { store, storage } = createStore([good, { id: 'x', label: 'ohne Nährwerte' }, 'müll']);
    expect(store.entries()).toHaveLength(1);
    expect(storage.quarantineNotices()[0]).toMatchObject({ key: 'diary', count: 2, saved: true });
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('nutritrack:quarantine.diary.'));
    expect(keys).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(keys[0]) as string).items).toHaveLength(2);
  });

  it('schreibt die bereinigte Liste zurück, sodass der Hinweis nicht bei jedem Start erscheint', () => {
    const { storage } = createStore([good, 'müll']);
    storage.flush();
    expect(JSON.parse(localStorage.getItem('nutritrack:diary') as string)).toHaveLength(1);
  });

  it('behandelt ein Objekt statt einer Liste als ganzes defekt und sichert es', () => {
    const { store, storage } = createStore({ oops: true });
    expect(store.entries()).toEqual([]);
    expect(storage.quarantineNotices()).toHaveLength(1);
  });

  it('add repariert ungültige Eingaben (Tag, Mahlzeit, Name) statt defekte Daten zu speichern', () => {
    const { store } = createStore([]);
    const entry = store.add({ dateISO: 'heute', meal: 'brunch' as never, label: '  ', facts: facts as never });
    expect(entry.dateISO).toBe(toDateISO());
    expect(entry.meal).toBe('snack');
    expect(entry.label).toBe('Eintrag');
  });

  it('restore lehnt einen Eintrag ohne Nährwerte ab, statt die Liste zu beschädigen', () => {
    const { store } = createStore([]);
    expect(store.restore({ ...good, facts: undefined } as never)).toBe(false);
    expect(store.entries()).toEqual([]);
  });
});
