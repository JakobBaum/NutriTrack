import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DiaryStore, copyEntriesTo } from './diary.store';
import { DiaryEntry, NutritionFacts } from '../models';

function facts(kcal: number): NutritionFacts {
  return { kcal, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
}

const SOURCE: DiaryEntry = {
  id: 'diary_alt',
  dateISO: '2026-10-12',
  meal: 'breakfast',
  label: 'Müsli',
  ref: { kind: 'food', foodItemId: 'f1' },
  amountG: 0.25,
  unit: 'l',
  facts: facts(300),
  baseFacts: { ...facts(120), basis: 'per100g' },
  isEstimate: true,
  isPartial: true,
  createdAt: '2026-10-12T07:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
});

describe('copyEntriesTo (rein)', () => {
  it('vergibt neue id, Datum und createdAt und behält Werte, Menge, Einheit und Flags', () => {
    // Arrange
    let n = 0;
    const newId = () => `neu_${++n}`;

    // Act
    const [copy] = copyEntriesTo([SOURCE], '2026-10-13', '2026-10-13T08:00:00.000Z', newId);

    // Assert
    expect(copy).toEqual({
      ...SOURCE,
      id: 'neu_1',
      dateISO: '2026-10-13',
      createdAt: '2026-10-13T08:00:00.000Z',
    });
  });

  it('verändert die Quelle nicht', () => {
    const before = structuredClone(SOURCE);
    copyEntriesTo([SOURCE], '2026-10-13');
    expect(SOURCE).toEqual(before);
  });

  it('liefert für leere Eingabe ein leeres Array', () => {
    expect(copyEntriesTo([], '2026-10-13')).toEqual([]);
  });
});

describe('DiaryStore update mit neuer Basis', () => {
  it('skaliert einen manuellen Eintrag über übergebene baseFacts neu', () => {
    const store = TestBed.inject(DiaryStore);
    const e = store.add({ dateISO: '2026-10-13', meal: 'breakfast', label: 'Orangensaft', amountG: 500, unit: 'l', facts: facts(225) });
    const per100: NutritionFacts = { kcal: 45, proteinG: 1, carbsG: 2, fatG: 0.4, basis: 'per100g' };

    store.update(e.id, { amountG: 250, unit: 'l', baseFacts: per100 });

    const [updated] = store.entries();
    expect(updated.facts.kcal).toBe(113);
    expect(updated.amountG).toBe(250);
    expect(updated.baseFacts).toEqual(per100);
  });

  it('ignoriert baseFacts, die nicht pro 100 sind', () => {
    const store = TestBed.inject(DiaryStore);
    const e = store.add({ dateISO: '2026-10-13', meal: 'breakfast', label: 'Saft', amountG: 500, facts: facts(225) });
    store.update(e.id, { amountG: 250, baseFacts: facts(10) });
    expect(store.entries()[0].facts.kcal).toBe(225);
    expect(store.entries()[0].baseFacts).toBeUndefined();
  });
});

describe('DiaryStore copy', () => {
  it('copyEntries legt Kopien im Zieltag an und lässt den Quelltag unverändert', () => {
    const store = TestBed.inject(DiaryStore);
    const a = store.add({ dateISO: '2026-10-12', meal: 'breakfast', label: 'Müsli', facts: facts(300), unit: 'ml', amountG: 200, isEstimate: true });
    const b = store.add({ dateISO: '2026-10-12', meal: 'breakfast', label: 'Kaffee', facts: facts(5) });

    const copies = store.copyEntries([a, b], '2026-10-13');

    expect(copies).toHaveLength(2);
    expect(copies.map((c) => c.id)).not.toContain(a.id);
    expect(new Set(copies.map((c) => c.id)).size).toBe(2);
    const target = store.entriesForMeal('2026-10-13', 'breakfast');
    expect(target.map((e) => e.label)).toEqual(['Müsli', 'Kaffee']);
    expect(target[0]).toMatchObject({ unit: 'ml', amountG: 200, isEstimate: true, facts: a.facts });
    expect(store.entriesForDate('2026-10-12')).toHaveLength(2);
  });

  it('copyEntries ignoriert ungültiges Datum und leere Listen', () => {
    const store = TestBed.inject(DiaryStore);
    const a = store.add({ dateISO: '2026-10-12', meal: 'lunch', label: 'Reis', facts: facts(400) });
    expect(store.copyEntries([a], 'kein-datum')).toEqual([]);
    expect(store.copyEntries([], '2026-10-13')).toEqual([]);
    expect(store.entries()).toHaveLength(1);
  });

  it('copyEntries persistiert die Kopien', () => {
    const store = TestBed.inject(DiaryStore);
    const a = store.add({ dateISO: '2026-10-12', meal: 'lunch', label: 'Reis', facts: facts(400) });
    store.copyEntries([a], '2026-10-13');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    expect(TestBed.inject(DiaryStore).entriesForDate('2026-10-13')).toHaveLength(1);
  });

  it('removeMany entfernt genau die Kopien (Rückgängig)', () => {
    const store = TestBed.inject(DiaryStore);
    const a = store.add({ dateISO: '2026-10-12', meal: 'lunch', label: 'Reis', facts: facts(400) });
    const copies = store.copyEntries([a], '2026-10-13');
    store.removeMany(copies.map((c) => c.id));
    expect(store.entriesForDate('2026-10-13')).toHaveLength(0);
    expect(store.entriesForDate('2026-10-12')).toHaveLength(1);
  });

  it('findCopySource nimmt den letzten Tag mit Einträgen der Mahlzeit (max. 7 Tage)', () => {
    const store = TestBed.inject(DiaryStore);
    store.add({ dateISO: '2026-10-10', meal: 'breakfast', label: 'Toast', facts: facts(200) });
    store.add({ dateISO: '2026-10-12', meal: 'lunch', label: 'Reis', facts: facts(400) });

    const src = store.findCopySource('2026-10-13', 'breakfast');

    expect(src?.dateISO).toBe('2026-10-10');
    expect(src?.entries.map((e) => e.label)).toEqual(['Toast']);
    expect(store.findCopySource('2026-10-13')?.dateISO).toBe('2026-10-12');
  });

  it('findCopySource liefert null außerhalb des Zeitfensters und ignoriert den Zieltag selbst', () => {
    const store = TestBed.inject(DiaryStore);
    store.add({ dateISO: '2026-10-05', meal: 'breakfast', label: 'Alt', facts: facts(200) });
    store.add({ dateISO: '2026-10-13', meal: 'breakfast', label: 'Heute', facts: facts(200) });
    expect(store.findCopySource('2026-10-13', 'breakfast')).toBeNull();
    expect(store.findCopySource('2026-10-13', 'breakfast', 8)?.dateISO).toBe('2026-10-05');
  });

  it('copySources listet alle früheren Tage mit Einträgen, neueste zuerst', () => {
    const store = TestBed.inject(DiaryStore);
    store.add({ dateISO: '2026-10-08', meal: 'dinner', label: 'Suppe', facts: facts(300) });
    store.add({ dateISO: '2026-10-11', meal: 'lunch', label: 'Reis', facts: facts(400) });
    expect(store.copySources('2026-10-13').map((s) => s.dateISO)).toEqual(['2026-10-11', '2026-10-08']);
    expect(store.copySources('ungültig')).toEqual([]);
  });
});
