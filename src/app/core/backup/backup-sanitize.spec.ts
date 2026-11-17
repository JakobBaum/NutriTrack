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

  it('verwirft ungültige Gewichte und führt doppelte Tage still zusammen (letzter gewinnt)', () => {
    const r = sanitizeBackupData({
      weight: [
        { dateISO: '2026-11-01', kg: 80 },
        { dateISO: '2026-11-01', kg: 79 },
        { dateISO: '2026-11-02', kg: 5 },
        { dateISO: 'x', kg: 80 },
      ],
    });
    expect(r.data['weight']).toEqual([{ dateISO: '2026-11-01', kg: 79 }]);
    expect(r.skipped).toBe(2);
    expect(r.repaired).toBe(1);
  });

  it('filtert kaputte Einkaufspositionen und behält die gültigen', () => {
    const ok = { id: 'i1', name: 'Milch', amount: 1, unit: 'l', checked: false };
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

describe('sanitizeBackupData Review 4 (D6, D7, D12, D13, D19)', () => {
  const recipe = (over: Record<string, unknown> = {}) => ({
    id: 'r1', title: 'Suppe', servings: 2, ingredients: [{ name: 'Wasser', amount: 1, unit: 'l' }], steps: ['kochen'], ...over,
  });
  const quarantinedKeys = (data: Record<string, unknown>): string[] => Object.keys(sanitizeBackupData(data).quarantined);

  it('repariert Rezepte mit negativen Mengen, Portionen <= 0 oder ungültigen Zutaten-Nährwerten und verwirft solche mit kaputten Schritten', () => {
    const repairable = [
      recipe({ id: 'a', servings: 0 }),
      recipe({ id: 'b', servings: -1 }),
      recipe({ id: 'c', ingredients: [{ name: 'X', amount: -5, unit: 'g' }] }),
      recipe({ id: 'd', ingredients: [{ name: 'X', amount: 5, unit: 'g', facts: { kcal: 'viel' } }] }),
      recipe({ id: 'e', ingredients: [{ name: 'X', amount: 5, unit: 'g', facts: { kcal: -1, proteinG: 1, carbsG: 1, fatG: 1 } }] }),
      recipe({ id: 'f', ingredients: [{ name: 'X', amount: null, unit: 'g', facts: null }] }),
    ];
    const bad = [recipe({ id: 'g', steps: [1, 2] })];
    const r = sanitizeBackupData({ recipes: [recipe(), ...repairable, ...bad] });
    expect((r.data['recipes'] as unknown[]).length).toBe(1 + repairable.length);
    expect(r.repaired).toBe(repairable.length);
    expect(r.skipped).toBe(bad.length);
  });

  it('verwirft Nährwerte mit negativen Werten in Mahlzeiten, eigenen Lebensmitteln und Favoriten', () => {
    const neg = { kcal: -1, proteinG: 1, carbsG: 1, fatG: 1 };
    expect(quarantinedKeys({
      savedMeals: [{ id: 'm', name: 'M', entries: [{ label: 'A', facts: neg }] }],
      customFoods: [{ id: 'c', name: 'C', facts: neg }],
      favorites: [{ id: 'f', label: 'F', facts: neg }],
    }).sort()).toEqual(['customFoods', 'favorites', 'savedMeals']);
  });

  it('behält gespeicherte Mahlzeiten mit und ohne isPartial/unit und verwirft falsche Typen', () => {
    const ok = { kcal: 1, proteinG: 1, carbsG: 1, fatG: 1, basis: 'perPortion' };
    const meal = (id: string, entry: Record<string, unknown>) => ({ id, name: 'M', entries: [{ label: 'A', facts: ok, ...entry }] });
    const r = sanitizeBackupData({
      savedMeals: [meal('alt', {}), meal('neu', { isPartial: true, unit: 'ml' }), meal('kaputt', { isPartial: 'ja' }), meal('einheit', { unit: 'kilo' })],
    });
    expect((r.data['savedMeals'] as { id: string }[]).map((m) => m.id)).toEqual(['alt', 'neu']);
  });

  it('verwirft Einkaufspositionen mit negativer Menge oder falschen Zusatzfeldern', () => {
    const ok = { id: 'i1', name: 'Milch', amount: 1, unit: 'l', checked: false };
    const r = sanitizeBackupData({
      shopping: { items: [ok, { ...ok, amount: -1 }, { ...ok, estPrice: 'x' }, { ...ok, userPrice: -2 }, { ...ok, category: 5 }, { ...ok, manual: 'ja' }] },
    });
    expect((r.data['shopping'] as { items: unknown[] }).items).toEqual([ok]);
    expect(r.skipped).toBe(5);
  });

  it('verwirft unmögliche Kalendertage bei Tagebuch-Datum nur über createdAt-Reparatur, bei Gewicht ganz', () => {
    const w = sanitizeBackupData({ weight: [{ dateISO: '2026-02-31', kg: 80 }] });
    expect(w.data['weight']).toEqual([]);
    const d = sanitizeBackupData({ diary: [diary({ dateISO: '2026-02-31' })] });
    expect((d.data['diary'] as Array<{ dateISO: string }>)[0].dateISO).toBe('2026-11-08');
    expect(d.repaired).toBe(1);
  });

  it('entfernt kaputte baseFacts von Favoriten, behält aber den Favoriten', () => {
    const fav = { id: 'f', label: 'F', facts, baseFacts: { kcal: 'x' } };
    const r = sanitizeBackupData({ favorites: [fav] });
    const items = r.data['favorites'] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect('baseFacts' in items[0]).toBe(false);
    expect(r.repaired).toBe(1);
  });

  it('normalisiert Zeitstempel mit Offset auf UTC (Z)', () => {
    const r = sanitizeBackupData({ diary: [diary({ createdAt: '2026-11-08T12:00:00+02:00' })] });
    expect((r.data['diary'] as Array<{ createdAt: string }>)[0].createdAt).toBe('2026-11-08T10:00:00.000Z');
    expect(r.repaired).toBe(1);
  });
});
