import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DiaryStore } from './diary.store';
import { MealType, NutritionFacts } from '../models';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const facts: NutritionFacts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };

function seed(rows: ReadonlyArray<{ label: string; meal: MealType; daysAgo: number; brand?: string }>): DiaryStore {
  const stored = rows.map((r, i) => ({
    id: `e${i}`,
    dateISO: '2026-11-01',
    meal: r.meal,
    label: r.label,
    brand: r.brand,
    ref: { kind: 'manual' },
    facts,
    createdAt: new Date(NOW.getTime() - r.daysAgo * 86_400_000 - i * 1000).toISOString(),
  }));
  localStorage.clear();
  localStorage.setItem('nutritrack:diary', JSON.stringify(stored));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  return TestBed.inject(DiaryStore);
}

describe('DiaryStore.recentFoods nach Essenszeit', () => {
  beforeEach(() => localStorage.clear());

  it('stellt Lebensmittel der gewählten Essenszeit vor die anderen', () => {
    const store = seed([
      { label: 'Pizza', meal: 'dinner', daysAgo: 0 },
      { label: 'Skyr', meal: 'breakfast', daysAgo: 1 },
    ]);
    expect(store.recentFoods(8, 'breakfast', NOW).map((e) => e.label)).toEqual(['Skyr', 'Pizza']);
  });

  it('sortiert innerhalb der Essenszeit nach Häufigkeit der letzten 30 Tage', () => {
    const store = seed([
      { label: 'Müsli', meal: 'breakfast', daysAgo: 0 },
      { label: 'Skyr', meal: 'breakfast', daysAgo: 2 },
      { label: 'Skyr', meal: 'breakfast', daysAgo: 3 },
      { label: 'Skyr', meal: 'breakfast', daysAgo: 4 },
    ]);
    expect(store.recentFoods(8, 'breakfast', NOW).map((e) => e.label)).toEqual(['Skyr', 'Müsli']);
  });

  it('zählt Einträge älter als 30 Tage nicht zur Häufigkeit', () => {
    const store = seed([
      { label: 'Müsli', meal: 'breakfast', daysAgo: 1 },
      { label: 'Skyr', meal: 'breakfast', daysAgo: 40 },
      { label: 'Skyr', meal: 'breakfast', daysAgo: 41 },
    ]);
    expect(store.recentFoods(8, 'breakfast', NOW).map((e) => e.label)).toEqual(['Müsli', 'Skyr']);
  });

  it('unterscheidet gleiche Namen verschiedener Marken und ignoriert Groß-/Kleinschreibung', () => {
    const store = seed([
      { label: 'Skyr', brand: 'Milbona', meal: 'snack', daysAgo: 0 },
      { label: 'skyr', brand: 'Milbona', meal: 'snack', daysAgo: 1 },
      { label: 'Skyr', brand: 'Ehrmann', meal: 'snack', daysAgo: 2 },
    ]);
    expect(store.recentFoods(8, 'snack', NOW)).toHaveLength(2);
  });

  it('respektiert das Limit und bleibt ohne Essenszeit chronologisch', () => {
    const store = seed([
      { label: 'A', meal: 'lunch', daysAgo: 0 },
      { label: 'B', meal: 'lunch', daysAgo: 1 },
      { label: 'C', meal: 'lunch', daysAgo: 2 },
    ]);
    expect(store.recentFoods(2).map((e) => e.label)).toEqual(['A', 'B']);
  });
});
