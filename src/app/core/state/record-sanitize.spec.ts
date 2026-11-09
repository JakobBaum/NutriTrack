import { describe, expect, it } from 'vitest';
import { sanitizeDiaryEntries, sanitizeList } from './record-sanitize';

const facts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
const entry = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  dateISO: '2026-11-08',
  meal: 'lunch',
  label: 'Skyr',
  ref: { kind: 'manual' },
  facts,
  createdAt: '2026-11-08T10:00:00.000Z',
  ...over,
});

describe('sanitizeDiaryEntries', () => {
  it('übernimmt gültige Einträge unverändert', () => {
    const e = entry();
    const r = sanitizeDiaryEntries([e]);
    expect(r.items).toEqual([e]);
    expect(r.rejected).toEqual([]);
    expect(r.repaired).toBe(0);
  });

  it('liefert bei Nicht-Array eine leere Liste ohne Absturz und verwirft den Rohwert', () => {
    expect(sanitizeDiaryEntries(null).items).toEqual([]);
    expect(sanitizeDiaryEntries({}).rejected).toEqual([{}]);
    expect(sanitizeDiaryEntries('x').items).toEqual([]);
    expect(sanitizeDiaryEntries(null).rejected).toEqual([]);
  });

  it('repariert fehlendes createdAt aus dem Tag (Mittag lokal)', () => {
    const { createdAt: _c, ...noCreated } = entry();
    const r = sanitizeDiaryEntries([noCreated]);
    expect(r.items).toHaveLength(1);
    expect(Number.isNaN(Date.parse(r.items[0].createdAt))).toBe(false);
    expect(new Date(r.items[0].createdAt).getHours()).toBe(12);
    expect(r.repaired).toBe(1);
  });

  it('repariert ungültiges createdAt', () => {
    const r = sanitizeDiaryEntries([entry({ createdAt: 'gestern' })]);
    expect(r.items[0].createdAt).not.toBe('gestern');
    expect(r.repaired).toBe(1);
  });

  it('leitet fehlenden Tag aus createdAt ab (lokales Datum)', () => {
    const createdAt = new Date(2026, 10, 7, 9, 0).toISOString();
    const r = sanitizeDiaryEntries([entry({ dateISO: undefined, createdAt })]);
    expect(r.items[0].dateISO).toBe('2026-11-07');
    expect(r.repaired).toBe(1);
  });

  it('verwirft Einträge ohne verwertbaren Tag', () => {
    const r = sanitizeDiaryEntries([entry({ dateISO: 'heute', createdAt: undefined })]);
    expect(r.items).toEqual([]);
    expect(r.rejected).toHaveLength(1);
  });

  it('vergibt fehlende oder doppelte ids neu', () => {
    const r = sanitizeDiaryEntries([entry({ id: undefined }), entry({ id: 'x' }), entry({ id: 'x' })]);
    const ids = r.items.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((i) => typeof i === 'string' && i !== '')).toBe(true);
    expect(r.repaired).toBe(2);
  });

  it('setzt ungültige Mahlzeit auf Snack und fehlenden Namen auf "Eintrag"', () => {
    const r = sanitizeDiaryEntries([entry({ meal: 'brunch', label: 5 })]);
    expect(r.items[0].meal).toBe('snack');
    expect(r.items[0].label).toBe('Eintrag');
    expect(r.repaired).toBe(1);
  });

  it('erfindet keine Nährwerte: kaputte oder fehlende facts verwerfen den Eintrag', () => {
    const r = sanitizeDiaryEntries([
      entry({ facts: undefined }),
      entry({ id: 'b', facts: { ...facts, kcal: null } }),
      entry({ id: 'c', facts: { ...facts, proteinG: -3 } }),
    ]);
    expect(r.items).toEqual([]);
    expect(r.rejected).toHaveLength(3);
  });

  it('entfernt ungültige optionale Werte statt den Eintrag zu verwerfen', () => {
    const r = sanitizeDiaryEntries([entry({ amountG: -5, servings: 'x', facts: { ...facts, fiberG: NaN } })]);
    expect(r.items[0].amountG).toBeUndefined();
    expect(r.items[0].servings).toBeUndefined();
    expect(r.items[0].facts.fiberG).toBeUndefined();
    expect(r.repaired).toBe(1);
  });

  it('ersetzt kaputtes ref durch manuell', () => {
    const r = sanitizeDiaryEntries([entry({ ref: 'x' })]);
    expect(r.items[0].ref).toEqual({ kind: 'manual' });
  });

  it('verwirft Nicht-Objekte', () => {
    const r = sanitizeDiaryEntries([1, null, 'a', [], entry()]);
    expect(r.items).toHaveLength(1);
    expect(r.rejected).toHaveLength(4);
  });

  it('verändert die Eingabe nicht', () => {
    const input = [entry({ createdAt: undefined })];
    const copy = JSON.parse(JSON.stringify(input));
    sanitizeDiaryEntries(input);
    expect(input).toEqual(copy);
  });
});

describe('sanitizeList', () => {
  const check = (v: unknown): boolean => typeof v === 'object' && v !== null && 'ok' in v;

  it('trennt gültige von ungültigen Datensätzen', () => {
    const r = sanitizeList([{ ok: 1 }, { no: 1 }, 5], check);
    expect(r.items).toEqual([{ ok: 1 }]);
    expect(r.rejected).toEqual([{ no: 1 }, 5]);
    expect(r.repaired).toBe(0);
  });

  it('liefert bei Nicht-Array leere Liste', () => {
    expect(sanitizeList(undefined, check).items).toEqual([]);
  });
});
