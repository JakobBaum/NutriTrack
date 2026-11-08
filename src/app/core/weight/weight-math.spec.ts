import { describe, expect, it } from 'vitest';
import {
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
  WeightEntry,
  driftSinceProfile,
  isValidWeight,
  removeWeight,
  smoothWeights,
  trendKgPerWeek,
  upsertWeight,
} from './weight-math';

const e = (dateISO: string, kg: number): WeightEntry => ({ dateISO, kg });
const day = (n: number): string => `2026-11-${String(n).padStart(2, '0')}`;

describe('isValidWeight', () => {
  it('accepts values inside 20 to 400 kg', () => {
    expect(isValidWeight(MIN_WEIGHT_KG)).toBe(true);
    expect(isValidWeight(75.5)).toBe(true);
    expect(isValidWeight(MAX_WEIGHT_KG)).toBe(true);
  });

  it('rejects out-of-range, NaN and non-numbers', () => {
    expect(isValidWeight(19.9)).toBe(false);
    expect(isValidWeight(400.1)).toBe(false);
    expect(isValidWeight(Number.NaN)).toBe(false);
    expect(isValidWeight(Infinity)).toBe(false);
    expect(isValidWeight('80')).toBe(false);
  });
});

describe('upsertWeight', () => {
  it('inserts sorted by date without mutating the input', () => {
    const list: readonly WeightEntry[] = [e('2026-11-05', 80), e('2026-11-07', 79)];
    const next = upsertWeight(list, e('2026-11-06', 79.5));
    expect(next.map((x) => x.dateISO)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07']);
    expect(list).toHaveLength(2);
  });

  it('replaces the entry of the same day (one entry per day)', () => {
    const next = upsertWeight([e('2026-11-05', 80)], e('2026-11-05', 79.2));
    expect(next).toEqual([e('2026-11-05', 79.2)]);
  });

  it('rounds to one decimal', () => {
    expect(upsertWeight([], e('2026-11-05', 79.26))[0].kg).toBe(79.3);
  });

  it('ignores invalid weights and dates', () => {
    const list = [e('2026-11-05', 80)];
    expect(upsertWeight(list, e('2026-11-06', 5))).toBe(list);
    expect(upsertWeight(list, e('06.11.2026', 80))).toBe(list);
  });
});

describe('removeWeight', () => {
  it('removes the entry of a day and keeps the rest', () => {
    const list = [e('2026-11-05', 80), e('2026-11-06', 79)];
    expect(removeWeight(list, '2026-11-05')).toEqual([e('2026-11-06', 79)]);
    expect(list).toHaveLength(2);
  });
});

describe('smoothWeights', () => {
  it('averages each point with the entries of the previous 7 days', () => {
    const out = smoothWeights([e('2026-11-01', 80), e('2026-11-02', 79), e('2026-11-10', 78)]);
    expect(out[0].kg).toBe(80);
    expect(out[1].kg).toBe(79.5);
    expect(out[2].kg).toBe(78);
  });

  it('returns an empty list for no data', () => {
    expect(smoothWeights([])).toEqual([]);
  });
});

describe('trendKgPerWeek', () => {
  it('returns null with fewer than two entries or a span under 7 days', () => {
    expect(trendKgPerWeek([])).toBeNull();
    expect(trendKgPerWeek([e('2026-11-01', 80)])).toBeNull();
    expect(trendKgPerWeek([e('2026-11-01', 80), e('2026-11-04', 79)])).toBeNull();
  });

  it('is negative for a falling series (about 0.5 kg per week)', () => {
    const list = Array.from({ length: 15 }, (_, i) => e(day(i + 1), 80 - i * (0.5 / 7)));
    const trend = trendKgPerWeek(list) as number;
    expect(trend).toBeGreaterThan(-0.6);
    expect(trend).toBeLessThan(-0.3);
  });

  it('is about zero for a flat series', () => {
    const list = Array.from({ length: 10 }, (_, i) => e(day(i + 1), 80));
    expect(Math.abs(trendKgPerWeek(list) as number)).toBeLessThan(0.01);
  });

  it('only looks at the last 28 days', () => {
    const old = [e('2026-09-01', 100), e('2026-09-02', 100)];
    const recent = Array.from({ length: 10 }, (_, i) => e(day(i + 1), 80));
    expect(Math.abs(trendKgPerWeek([...old, ...recent]) as number)).toBeLessThan(0.01);
  });
});

describe('driftSinceProfile', () => {
  it('returns the signed difference when it reaches 2 kg', () => {
    expect(driftSinceProfile(78, 75.9)).toBeCloseTo(-2.1, 5);
    expect(driftSinceProfile(78, 80)).toBe(2);
  });

  it('returns null below 2 kg or for missing data', () => {
    expect(driftSinceProfile(78, 76.5)).toBeNull();
    expect(driftSinceProfile(78, null)).toBeNull();
    expect(driftSinceProfile(null, 80)).toBeNull();
  });
});
