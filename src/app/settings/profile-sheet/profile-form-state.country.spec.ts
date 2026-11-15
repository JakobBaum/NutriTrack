import { describe, expect, it } from 'vitest';
import { UserProfile } from '../../core/models';
import { formStateFromProfile, profileFromFormState } from './profile-form-state';

const saved: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'lose', rateKgPerWeek: 0.5, updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('Fastfood-Land im Formular', () => {
  it('startet mit Österreich oder dem übergebenen Ersatzland', () => {
    expect(formStateFromProfile(null).fastfoodCountry).toBe('Österreich');
    expect(formStateFromProfile(null, 'Italien').fastfoodCountry).toBe('Italien');
  });

  it('nimmt das Land aus dem Profil vor dem Ersatzland', () => {
    expect(formStateFromProfile({ ...saved, fastfoodCountry: 'Schweiz' }, 'Italien').fastfoodCountry).toBe('Schweiz');
    expect(formStateFromProfile(saved, 'Italien').fastfoodCountry).toBe('Italien');
  });

  it('schreibt das gewählte Land immer ausdrücklich ins Profil', () => {
    const state = { ...formStateFromProfile(saved), fastfoodCountry: 'Spanien' };
    expect(profileFromFormState(state, 'x')?.fastfoodCountry).toBe('Spanien');
    expect(profileFromFormState(formStateFromProfile(saved), 'x')?.fastfoodCountry).toBe('Österreich');
  });
});
