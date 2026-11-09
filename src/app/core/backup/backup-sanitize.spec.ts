import { describe, expect, it } from 'vitest';
import { sanitizeBackupData } from './backup-sanitize';

const facts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
const diary = (over: Record<string, unknown> = {}) => ({
  id: 'd1', dateISO: '2026-11-08', meal: 'lunch', label: 'Reis', ref: { kind: 'manual' }, facts, createdAt: '2026-11-08T10:00:00.000Z', ...over,
});

describe('sanitizeBackupData', () => {
  it('lässt gültige Daten unverändert', () => {
    const data = { diary: [diary()], profile: null, weight: [{ dateISO: '2026-11-01', kg: 80 }] };
    const r = sanitizeBackupData(data);
    expect(r.data).toEqual(data);
    expect(r.skipped).toBe(0);
    expect(r.repaired).toBe(0);
    expect(r.quarantined).toEqual({});
  });

  it('repariert ein Tagebuch ohne createdAt statt es abzulehnen', () => {
    const r = sanitizeBackupData({ diary: [diary({ createdAt: undefined })] });
    expect((r.data['diary'] as unknown[]).length).toBe(1);
    expect(r.repaired).toBe(1);
    expect(r.skipped).toBe(0);
  });

  it('sortiert unbrauchbare Datensätze je Schlüssel in die Quarantäne', () => {
    const bad = { id: 'x' };
    const r = sanitizeBackupData({
      diary: [diary(), { ...diary({ id: 'd2' }), facts: undefined }],
      recipes: [{ id: 'r', servings: 2 }, { id: 'r2', title: 'Ok', servings: 2, ingredients: [] }],
      customFoods: [bad],
      savedMeals: [{ id: 'm', name: 'M' }],
      favorites: [bad],
    });
    expect((r.data['diary'] as unknown[]).length).toBe(1);
    expect((r.data['recipes'] as unknown[]).length).toBe(1);
    expect(r.data['customFoods']).toEqual([]);
    expect(r.skipped).toBe(5);
    expect(Object.keys(r.quarantined).sort()).toEqual(['customFoods', 'diary', 'favorites', 'recipes', 'savedMeals']);
  });

  it('verwirft ungültige Gewichte und doppelte Tage (letzter gewinnt)', () => {
    const r = sanitizeBackupData({
      weight: [
        { dateISO: '2026-11-01', kg: 80 },
        { dateISO: '2026-11-01', kg: 79 },
        { dateISO: '2026-11-02', kg: 5 },
        { dateISO: 'x', kg: 80 },
      ],
    });
    expect(r.data['weight']).toEqual([{ dateISO: '2026-11-01', kg: 79 }]);
    expect(r.skipped).toBe(3);
  });

  it('filtert kaputte Einkaufspositionen und behält die gültigen', () => {
    const ok = { name: 'Milch', amount: 1, unit: 'l', checked: false };
    const r = sanitizeBackupData({ shopping: { items: [ok, { name: 'X' }], other: 1 } });
    expect(r.data['shopping']).toEqual({ items: [ok], other: 1 });
    expect(r.skipped).toBe(1);
  });

  it('sichert eine Einkaufsliste ohne items als Ganzes und entfernt sie', () => {
    const r = sanitizeBackupData({ shopping: { foo: 1 } });
    expect('shopping' in r.data).toBe(false);
    expect(r.quarantined['shopping']).toHaveLength(1);
  });

  it('verändert die Eingabe nicht', () => {
    const input = { diary: [diary({ createdAt: undefined })] };
    const copy = JSON.parse(JSON.stringify(input));
    sanitizeBackupData(input);
    expect(input).toEqual(copy);
  });
});
