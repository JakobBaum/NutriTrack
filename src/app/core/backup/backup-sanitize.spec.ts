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

describe('sanitizeBackupData Profil und Wochenplan (Review 3, Befund 6)', () => {
  const profile = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '2026-11-01T10:00:00.000Z' };

  it('behält ein gültiges Profil', () => {
    expect(sanitizeBackupData({ profile }).data['profile']).toEqual(profile);
  });

  it('verwirft ein kaputtes Profil und legt es in Quarantäne', () => {
    const r = sanitizeBackupData({ profile: { weightKg: 'x' } });
    expect('profile' in r.data).toBe(false);
    expect(r.quarantined['profile']).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });

  it('verwirft einen kaputten Wochenplan und bereinigt gesperrte Ids', () => {
    const r = sanitizeBackupData({ 'week-plan': { id: 1 }, 'week-plan-blocked': ['a', 2] });
    expect('week-plan' in r.data).toBe(false);
    expect(r.data['week-plan-blocked']).toEqual(['a']);
    expect(r.skipped).toBe(2);
  });
});

describe('sanitizeBackupData Online-Verweise', () => {
  const ingredients = [{ name: 'Reis', amount: 1, unit: 'g' }];
  const ref = { source: 'spoonacular', externalId: '4242', savedAt: '2026-11-01T10:00:00.000Z' };

  it('entfernt ein ungültiges onlineRef (null) und behält das Rezept mit Zutaten', () => {
    const r = sanitizeBackupData({ recipes: [{ id: 'r', title: 'A', servings: 2, ingredients, onlineRef: null }] });
    expect(r.data['recipes']).toEqual([{ id: 'r', title: 'A', servings: 2, ingredients }]);
    expect(r.repaired).toBe(1);
  });

  it('verwirft einen Verweis ohne Zutaten mit ungültiger Referenz', () => {
    const bad = { id: 'r', title: 'A', servings: 1, ingredients: [], onlineRef: { ...ref, externalId: 'x' } };
    const r = sanitizeBackupData({ recipes: [bad] });
    expect(r.data['recipes']).toEqual([]);
    expect(r.quarantined['recipes']).toEqual([bad]);
  });

  it('behält einen gültigen Verweis', () => {
    const good = { id: 'r', title: 'A', servings: 1, ingredients: [], onlineRef: ref };
    expect(sanitizeBackupData({ recipes: [good] }).data['recipes']).toEqual([good]);
  });
});
