import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysISO, dayLabel, rollDate, toDateISO } from './date';
import { makeId } from './id';

describe('date-Helfer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0)); // Do., 15.10.2026 lokal
  });
  afterEach(() => vi.useRealTimers());

  it('formatiert lokal mit führenden Nullen', () => {
    expect(toDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateISO()).toBe('2026-10-15');
  });

  it('verschiebt über Monats- und Jahresgrenzen', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2026-10-15', 0)).toBe('2026-10-15');
  });

  it('beschriftet heute/gestern/morgen und sonst Wochentag + Datum', () => {
    expect(dayLabel('2026-10-15')).toBe('Heute');
    expect(dayLabel('2026-10-14')).toBe('Gestern');
    expect(dayLabel('2026-10-16')).toBe('Morgen');
    expect(dayLabel('2026-10-12')).toBe('Mo., 12.10.');
    expect(dayLabel('2026-03-01')).toBe('So., 01.03.');
  });
});

describe('makeId', () => {
  it('nutzt das Präfix und erzeugt unterschiedliche IDs', () => {
    const a = makeId('food');
    const b = makeId('food');
    expect(a.startsWith('food_')).toBe(true);
    expect(a).not.toBe(b);
    expect(makeId().startsWith('id_')).toBe(true);
  });
});

describe('rollDate (QAD-02)', () => {
  it('springt mit, wenn der Nutzer auf "Heute" stand und der Tag wechselt', () => {
    expect(rollDate('2026-11-08', '2026-11-08', '2026-11-09')).toEqual({ selected: '2026-11-09', today: '2026-11-09' });
  });

  it('lässt einen bewusst gewählten anderen Tag stehen', () => {
    expect(rollDate('2026-11-01', '2026-11-08', '2026-11-09')).toEqual({ selected: '2026-11-01', today: '2026-11-09' });
  });

  it('ändert nichts, solange derselbe Tag gilt', () => {
    expect(rollDate('2026-11-08', '2026-11-08', '2026-11-08')).toEqual({ selected: '2026-11-08', today: '2026-11-08' });
  });
});
