import { describe, expect, it } from 'vitest';
import { UserProfile } from '../../core/models';
import {
  emptyFormState,
  formStateFromProfile,
  manualErrors,
  profileFromFormState,
  rateChoicesFor,
  rateForGoal,
  withManualEnabled,
} from './profile-form-state';

const saved: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'lose', rateKgPerWeek: 0.5, updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('rateChoicesFor / rateForGoal', () => {
  it('bietet für Aufbau kleinere Tempi als für Abnehmen', () => {
    expect(rateChoicesFor('lose').map((c) => c.value)).toEqual([0.25, 0.5, 0.75]);
    expect(rateChoicesFor('gain').map((c) => c.value)).toEqual([0.1, 0.25, 0.4]);
  });

  it('behält ein passendes Tempo und wählt sonst das nächstliegende', () => {
    expect(rateForGoal('lose', 0.75)).toBe(0.75);
    expect(rateForGoal('gain', 0.5)).toBe(0.4);
    expect(rateForGoal('gain', null)).toBe(0.25);
    expect(rateForGoal('lose', undefined)).toBe(0.5);
  });
});

describe('formStateFromProfile', () => {
  it('startet ohne Profil leer und ohne manuelle Ziele', () => {
    const s = formStateFromProfile(null);
    expect(s).toEqual(emptyFormState());
    expect(s.weightKg).toBeNull();
    expect(s.manual).toBe(false);
  });

  it('übernimmt Profilwerte und liest manuelle Ziele als Text', () => {
    const s = formStateFromProfile({ ...saved, manualKcal: 2300, manualProteinGPerKg: 2.1, targetWeightKg: 75 });
    expect(s.weightKg).toBe(80);
    expect(s.targetWeightKg).toBe(75);
    expect(s.manual).toBe(true);
    expect(s.manualKcalText).toBe('2300');
    expect(s.manualProteinText).toBe('2,1');
  });

  it('korrigiert ein altes, für Aufbau zu hohes Tempo', () => {
    expect(formStateFromProfile({ ...saved, goal: 'gain', rateKgPerWeek: 0.75 }).rateKgPerWeek).toBe(0.4);
  });
});

describe('profileFromFormState', () => {
  const full = formStateFromProfile(saved);

  it('baut das Profil ohne manuelle Felder, wenn automatisch gewählt ist', () => {
    const p = profileFromFormState(full, 'jetzt');
    expect(p).toMatchObject({ weightKg: 80, goal: 'lose', rateKgPerWeek: 0.5, updatedAt: 'jetzt' });
    expect(p).not.toHaveProperty('manualKcal');
    expect(p).not.toHaveProperty('manualProteinGPerKg');
  });

  it('liefert null, solange Gewicht, Größe oder Alter fehlen', () => {
    expect(profileFromFormState({ ...full, weightKg: null }, 'x')).toBeNull();
  });

  it('setzt rateKgPerWeek bei Halten auf 0', () => {
    expect(profileFromFormState({ ...full, goal: 'maintain' }, 'x')?.rateKgPerWeek).toBe(0);
  });

  it('übernimmt gültige manuelle Ziele und lässt ungültige weg', () => {
    const manual = { ...full, manual: true, manualKcalText: '2400', manualProteinText: '2,2' };
    expect(profileFromFormState(manual, 'x')).toMatchObject({ manualKcal: 2400, manualProteinGPerKg: 2.2 });
    const bad = { ...manual, manualKcalText: '99', manualProteinText: '2,2' };
    const p = profileFromFormState(bad, 'x');
    expect(p).not.toHaveProperty('manualKcal');
    expect(p).toMatchObject({ manualProteinGPerKg: 2.2 });
  });

  it('verändert den Eingabezustand nicht', () => {
    const copy = JSON.stringify(full);
    profileFromFormState(full, 'x');
    expect(JSON.stringify(full)).toBe(copy);
  });
});

describe('manualErrors', () => {
  const base = { ...formStateFromProfile(saved), manual: true };

  it('meldet nichts, solange automatisch gewählt ist', () => {
    expect(manualErrors({ ...base, manual: false, manualKcalText: '5' })).toEqual({});
  });

  it('meldet Fehler pro Feld', () => {
    const e = manualErrors({ ...base, manualKcalText: '500', manualProteinText: '' });
    expect(e.kcal).toBeTruthy();
    expect(e.protein).toBeTruthy();
    expect(manualErrors({ ...base, manualKcalText: '2200', manualProteinText: '2' })).toEqual({});
  });
});

describe('withManualEnabled', () => {
  it('füllt die Felder mit den Formelwerten vor', () => {
    const s = withManualEnabled(formStateFromProfile(saved), { kcal: 2209, proteinG: 144 });
    expect(s.manual).toBe(true);
    expect(s.manualKcalText).toBe('2209');
    expect(s.manualProteinText).toBe('1,8');
  });

  it('lässt vorhandene Eingaben stehen', () => {
    const start = { ...formStateFromProfile(saved), manualKcalText: '2000' };
    expect(withManualEnabled(start, { kcal: 2209, proteinG: 144 }).manualKcalText).toBe('2000');
  });
});

describe('Ernährungsangaben im Formular', () => {
  it('übernimmt Ernährungsangaben aus dem Profil und schreibt sie wieder zurück', () => {
    const profile: UserProfile = {
      ...saved, diet: 'vegan', intolerances: ['soy'], dislikes: ['Pilze'], dislikesEn: ['mushrooms'],
    };
    const state = formStateFromProfile(profile);
    expect(state.dietPrefs).toMatchObject({ diet: 'vegan', intolerances: ['soy'], dislikes: ['Pilze'], dislikesEn: ['mushrooms'] });
    expect(profileFromFormState(state, 'x')).toMatchObject({
      diet: 'vegan', intolerances: ['soy'], dislikes: ['Pilze'], dislikesEn: ['mushrooms'],
    });
  });

  it('lässt leere Ernährungsangaben im Profil weg', () => {
    const result = profileFromFormState(formStateFromProfile(saved), 'x');
    expect(result).not.toBeNull();
    expect(Object.keys(result as object)).not.toContain('diet');
    expect(Object.keys(result as object)).not.toContain('dislikes');
  });

  it('startet ohne Profil mit leeren Ernährungsangaben', () => {
    expect(formStateFromProfile(null).dietPrefs).toEqual({ diet: '', intolerances: [], dislikes: [], dislikesEn: [] });
  });
});
