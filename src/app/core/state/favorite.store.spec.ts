import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DiaryEntry } from '../models';
import { FavoriteStore, favoriteKey, newEntryFromFavorite } from './favorite.store';

const entry = (label: string, extra: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: `e-${label}`,
  dateISO: '2026-11-06',
  meal: 'lunch',
  label,
  ref: { kind: 'manual' },
  amountG: 150,
  unit: 'g',
  facts: { kcal: 90, proteinG: 16, carbsG: 6, fatG: 0.3, basis: 'perPortion' },
  createdAt: '2026-11-06T10:00:00.000Z',
  ...extra,
});

describe('FavoriteStore', () => {
  let store: FavoriteStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    store = TestBed.inject(FavoriteStore);
  });

  it('toggles an entry on and off', () => {
    expect(store.toggle(entry('Skyr'))).toBe(true);
    expect(store.isFavorite({ label: 'skyr' })).toBe(true);
    expect(store.toggle(entry('Skyr'))).toBe(false);
    expect(store.favorites()).toEqual([]);
  });

  it('keeps amount and facts and drops day and meal', () => {
    store.toggle(entry('Skyr'));
    const fav = store.favorites()[0];
    expect(fav.amountG).toBe(150);
    expect(fav.facts.proteinG).toBe(16);
    expect('dateISO' in fav).toBe(false);
    expect('meal' in fav).toBe(false);
  });

  it('persists and reloads', () => {
    store.toggle(entry('Skyr'));
    TestBed.resetTestingModule();
    expect(TestBed.inject(FavoriteStore).favorites()).toHaveLength(1);
  });

  it('puts the newest favorite first and clears', () => {
    store.toggle(entry('A'));
    store.toggle(entry('B'));
    expect(store.favorites().map((f) => f.label)).toEqual(['B', 'A']);
    store.clear();
    expect(store.favorites()).toEqual([]);
  });

  it('distinguishes products by brand', () => {
    expect(favoriteKey({ label: 'Skyr', brand: 'A' })).not.toBe(favoriteKey({ label: 'Skyr', brand: 'B' }));
  });

  it('builds a new entry for a day and meal from a favorite', () => {
    store.toggle(entry('Skyr'));
    const input = newEntryFromFavorite(store.favorites()[0], '2026-11-08', 'snack');
    expect(input).toMatchObject({ dateISO: '2026-11-08', meal: 'snack', label: 'Skyr', amountG: 150 });
    expect('id' in input).toBe(false);
  });

  it('ignores broken stored records', () => {
    localStorage.setItem('nutritrack:favorites', JSON.stringify([{ id: 'x' }, null, 5]));
    TestBed.resetTestingModule();
    expect(TestBed.inject(FavoriteStore).favorites()).toEqual([]);
  });
});
