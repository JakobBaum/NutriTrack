import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../storage/storage.service';
import { WeightStore, sanitizeWeights } from './weight.store';

describe('WeightStore', () => {
  let store: WeightStore;
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    storage = TestBed.inject(StorageService);
    store = TestBed.inject(WeightStore);
  });

  it('stores one entry per day and persists it', () => {
    expect(store.set('2026-11-05', 80)).toBe(true);
    expect(store.set('2026-11-05', 79.4)).toBe(true);
    expect(store.entries()).toEqual([{ dateISO: '2026-11-05', kg: 79.4 }]);
    expect(storage.get('weight', [])).toEqual([{ dateISO: '2026-11-05', kg: 79.4 }]);
  });

  it('rejects weights outside 20 to 400 kg', () => {
    expect(store.set('2026-11-05', 10)).toBe(false);
    expect(store.set('2026-11-05', 500)).toBe(false);
    expect(store.set('2026-11-05', Number.NaN)).toBe(false);
    expect(store.entries()).toEqual([]);
  });

  it('exposes the latest entry', () => {
    store.set('2026-11-06', 79);
    store.set('2026-11-05', 80);
    expect(store.latest()).toEqual({ dateISO: '2026-11-06', kg: 79 });
  });

  it('removes an entry and clears everything', () => {
    store.set('2026-11-05', 80);
    store.set('2026-11-06', 79);
    store.remove('2026-11-05');
    expect(store.entries()).toHaveLength(1);
    store.clear();
    expect(store.entries()).toEqual([]);
    expect(storage.get('weight', null)).toBeNull();
  });

  it('never mutates a previously read list', () => {
    store.set('2026-11-05', 80);
    const before = store.entries();
    store.set('2026-11-06', 79);
    expect(before).toHaveLength(1);
  });
});

describe('sanitizeWeights', () => {
  it('drops broken records and duplicates', () => {
    const out = sanitizeWeights([
      { dateISO: '2026-11-05', kg: 80 },
      { dateISO: '2026-11-05', kg: 79 },
      { dateISO: 'x', kg: 80 },
      { dateISO: '2026-11-06', kg: 1 },
      null,
    ]);
    expect(out).toEqual([{ dateISO: '2026-11-05', kg: 79 }]);
  });

  it('returns an empty list for non-arrays', () => {
    expect(sanitizeWeights({})).toEqual([]);
  });
});
