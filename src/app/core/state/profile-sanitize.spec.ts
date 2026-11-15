import { describe, expect, it } from 'vitest';
import { sanitizeProfile } from './profile-sanitize';

const valid = () => ({
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'lose',
  rateKgPerWeek: 0.5, updatedAt: '2026-11-01T10:00:00.000Z',
});

describe('sanitizeProfile (Review 3, Befund 6)', () => {
  it('lässt ein gültiges Profil unverändert', () => {
    expect(sanitizeProfile(valid())).toEqual(valid());
  });

  it.each([null, undefined, 42, 'x', [], [valid()]])('verwirft %j', (raw) => {
    expect(sanitizeProfile(raw)).toBeNull();
  });

  it.each([
    ['weightKg als Text', { weightKg: '80' }],
    ['weightKg außerhalb', { weightKg: 5 }],
    ['heightCm NaN', { heightCm: Number.NaN }],
    ['age negativ', { age: -3 }],
    ['unbekanntes Geschlecht', { sex: 'robot' }],
    ['unbekannte Aktivität', { activityLevel: 'x' }],
    ['unbekanntes Ziel', { goal: 'bulk' }],
  ])('verwirft das Profil bei %s', (_name, over) => {
    expect(sanitizeProfile({ ...valid(), ...over })).toBeNull();
  });

  it('lässt unbrauchbare optionale Zahlen weg, behält den Rest', () => {
    const r = sanitizeProfile({ ...valid(), manualKcal: 99999, manualProteinGPerKg: 'viel', targetWeightKg: -1 });
    expect(r).toEqual(valid());
  });

  it('behält gültige manuelle Ziele', () => {
    const r = sanitizeProfile({ ...valid(), manualKcal: 2200, manualProteinGPerKg: 1.6 });
    expect(r?.manualKcal).toBe(2200);
    expect(r?.manualProteinGPerKg).toBe(1.6);
  });

  it('ersetzt ein fehlendes updatedAt durch einen festen Wert', () => {
    const { updatedAt: _u, ...rest } = valid();
    expect(typeof sanitizeProfile(rest)?.updatedAt).toBe('string');
  });

  it('bereinigt Ernährungsangaben', () => {
    const r = sanitizeProfile({ ...valid(), diet: 'unsinn', intolerances: ['dairy', 7] });
    expect(r?.diet).toBeUndefined();
    expect(r?.intolerances).toEqual(['dairy']);
  });
});
