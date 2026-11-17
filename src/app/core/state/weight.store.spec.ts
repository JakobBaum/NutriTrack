import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from '../storage/storage.service';
import { WeightStore } from './weight.store';
import { sanitizeWeightEntries } from './weight-sanitize';

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

  it('meldet false, wenn das Speichern scheitert', () => {
    vi.spyOn(storage, 'set').mockReturnValue(false);
    expect(store.set('2026-11-05', 80)).toBe(false);
  });

  it('rollt den Wert zurück, wenn das Speichern scheitert', () => {
    store.set('2026-11-05', 80);
    vi.spyOn(storage, 'set').mockReturnValue(false);
    expect(store.set('2026-11-05', 70)).toBe(false);
    expect(store.entries()).toEqual([{ dateISO: '2026-11-05', kg: 80 }]);
    expect(store.remove('2026-11-05')).toBe(false);
    expect(store.entries()).toHaveLength(1);
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

  it('merkt sich das Ausblenden des Gewichtshinweises dauerhaft und vergisst es beim Zurücksetzen', () => {
    expect(store.driftHintDismissedAtKg()).toBeNull();
    store.dismissDriftHint(75.5);
    expect(store.driftHintDismissedAtKg()).toBe(75.5);
    expect(storage.get('weightHintDismissedAtKg', null)).toBe(75.5);
    store.clear();
    expect(store.driftHintDismissedAtKg()).toBeNull();
    expect(storage.get('weightHintDismissedAtKg', null)).toBeNull();
  });

  it('never mutates a previously read list', () => {
    store.set('2026-11-05', 80);
    const before = store.entries();
    store.set('2026-11-06', 79);
    expect(before).toHaveLength(1);
  });
});

describe('sanitizeWeightEntries', () => {
  it('drops broken records and duplicates', () => {
    const out = sanitizeWeightEntries([
      { dateISO: '2026-11-05', kg: 80 },
      { dateISO: '2026-11-05', kg: 79 },
      { dateISO: 'x', kg: 80 },
      { dateISO: '2026-11-06', kg: 1 },
      null,
    ]);
    expect(out.items).toEqual([{ dateISO: '2026-11-05', kg: 79 }]);
  });

  it('rundet auf 0,1 kg und führt doppelte Tage still zusammen (jüngster gewinnt, nicht in rejected)', () => {
    const out = sanitizeWeightEntries([
      { dateISO: '2026-11-05', kg: 80.04 },
      { dateISO: '2026-11-05', kg: 79.26 },
      { dateISO: '2026-11-06', kg: 78.449 },
      { dateISO: '2026-11-07', kg: 77.5 },
    ]);
    expect(out.items).toEqual([
      { dateISO: '2026-11-05', kg: 79.3 },
      { dateISO: '2026-11-06', kg: 78.4 },
      { dateISO: '2026-11-07', kg: 77.5 },
    ]);
    expect(out.rejected).toEqual([]);
    expect(out.repaired).toBe(3);
  });

  it('returns an empty list for non-arrays', () => {
    expect(sanitizeWeightEntries({}).items).toEqual([]);
  });
});

describe('WeightStore Laden (D9)', () => {
  function load(raw: unknown): { store: WeightStore; storage: StorageService } {
    localStorage.clear();
    localStorage.setItem('nutritrack:weight', JSON.stringify(raw));
    TestBed.resetTestingModule();
    return { store: TestBed.inject(WeightStore), storage: TestBed.inject(StorageService) };
  }

  it('sichert ungültige Einträge in Quarantäne statt sie still zu verwerfen', () => {
    const { store, storage } = load([{ dateISO: '2026-11-05', kg: 80 }, { dateISO: '2026-02-31', kg: 80 }, { dateISO: '2026-11-06', kg: 5 }]);
    expect(store.entries()).toEqual([{ dateISO: '2026-11-05', kg: 80 }]);
    expect(storage.quarantineNotices()).toHaveLength(1);
    expect(storage.quarantineNotices()[0].count).toBe(2);
  });

  it('sortiert nach Datum', () => {
    const { store } = load([{ dateISO: '2026-11-06', kg: 79 }, { dateISO: '2026-11-05', kg: 80 }]);
    expect(store.entries().map((e) => e.dateISO)).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('bietet Schreibsperre und Erfolg von persist', () => {
    const { store, storage } = load([]);
    expect(store.isReadOnly()).toBe(false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:weight' }));
    expect(store.isReadOnly()).toBe(true);
    expect(storage.writeLocked()).toBe(true);
  });
});
