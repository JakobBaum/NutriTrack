import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DiaryStore, NewDiaryEntry } from './diary.store';
import { NutritionFacts } from '../models';

const facts = (kcal: number): NutritionFacts => ({ kcal, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' });

const input = (over: Partial<NewDiaryEntry> = {}): NewDiaryEntry => ({
  dateISO: '2026-11-08',
  meal: 'lunch',
  label: 'Reis',
  facts: facts(200),
  ...over,
});

let store: DiaryStore;

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  store = TestBed.inject(DiaryStore);
});

describe('DiaryStore.add Mengenprüfung (QAE-03)', () => {
  it('verwirft NaN, Infinity, 0 und negative Mengen statt sie zu speichern', () => {
    for (const bad of [NaN, Infinity, 0, -5]) {
      const entry = store.add(input({ amountG: bad, servings: bad }));
      expect(entry.amountG).toBeUndefined();
      expect(entry.servings).toBeUndefined();
    }
  });

  it('behält gültige Mengen', () => {
    const entry = store.add(input({ amountG: 150, servings: 2 }));
    expect(entry.amountG).toBe(150);
    expect(entry.servings).toBe(2);
  });

  it('ersetzt nicht endliche oder negative Nährwerte durch 0', () => {
    const entry = store.add(input({ facts: { ...facts(NaN), proteinG: Infinity, carbsG: -3, saltG: NaN } }));
    expect(entry.facts).toMatchObject({ kcal: 0, proteinG: 0, carbsG: 0 });
    expect(entry.facts.saltG).toBeUndefined();
  });
});

describe('DiaryStore.update skaliert Salz mit (QAD-03)', () => {
  it('rechnet saltG bei Mengenänderung aus der Basis neu', () => {
    const entry = store.add(
      input({
        amountG: 100,
        facts: { ...facts(100), saltG: 1, basis: 'perPortion' },
        baseFacts: { ...facts(100), saltG: 1, basis: 'per100g' },
      }),
    );

    store.update(entry.id, { amountG: 250 });

    expect(store.entries()[0].facts.saltG).toBe(2.5);
  });
});

describe('DiaryStore.restore (QAD-06, QAD-07)', () => {
  it('legt den Eintrag mit alter Id und alter Position wieder an', () => {
    const a = store.add(input({ label: 'A' }));
    const b = store.add(input({ label: 'B' }));
    store.add(input({ label: 'C' }));
    const index = store.indexOf(b.id);
    store.remove(b.id);

    const restored = store.restore(b, index);

    expect(restored).toBe(true);
    expect(store.entriesForDate('2026-11-08').map((e) => e.label)).toEqual(['A', 'B', 'C']);
    expect(store.entries().some((e) => e.id === b.id)).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it('legt nichts doppelt an, wenn die Id schon existiert', () => {
    const a = store.add(input());

    expect(store.restore(a)).toBe(false);
    expect(store.entries()).toHaveLength(1);
  });
});

describe('DiaryStore.copyEntries Duplikat-Schutz (QAD-05)', () => {
  it('kopiert einen Quelltag beim zweiten Mal nicht noch einmal', () => {
    const src = [store.add(input({ dateISO: '2026-11-07', label: 'A' })), store.add(input({ dateISO: '2026-11-07', label: 'B' }))];

    const first = store.copyEntries(src, '2026-11-08');
    const second = store.copyEntries(src, '2026-11-08');

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(0);
    expect(store.entriesForDate('2026-11-08')).toHaveLength(2);
  });

  it('kopiert gleiche Einträge im Quelltag so oft, wie sie dort vorkommen', () => {
    const src = [store.add(input({ dateISO: '2026-11-07' })), store.add(input({ dateISO: '2026-11-07' }))];

    expect(store.copyEntries(src, '2026-11-08')).toHaveLength(2);
  });
});

describe('DiaryStore.update Name und Menge löschen (QAD-01, QAD-04)', () => {
  it('behält den alten Namen, wenn der neue leer oder undefined ist', () => {
    const entry = store.add(input({ label: 'Reis' }));

    store.update(entry.id, { label: undefined });
    expect(store.entries()[0].label).toBe('Reis');

    store.update(entry.id, { label: '   ' });
    expect(store.entries()[0].label).toBe('Reis');
  });

  it('übernimmt einen neuen Namen getrimmt', () => {
    const entry = store.add(input({ label: 'Reis' }));

    store.update(entry.id, { label: '  Basmati ' });

    expect(store.entries()[0].label).toBe('Basmati');
  });

  it('entfernt die Anzeige-Menge, wenn clearAmount gesetzt ist', () => {
    const entry = store.add(input({ amountG: 200, unit: 'g' }));

    store.update(entry.id, { clearAmount: true });

    expect(store.entries()[0].amountG).toBeUndefined();
    expect(store.entries()[0].unit).toBeUndefined();
  });
});
