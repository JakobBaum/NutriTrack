import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ProfileStore } from './profile.store';

const valid = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '2026-11-01T10:00:00.000Z' };

function load(raw: unknown): ProfileStore {
  localStorage.clear();
  localStorage.setItem('nutritrack:profile', JSON.stringify(raw));
  TestBed.resetTestingModule();
  return TestBed.inject(ProfileStore);
}

describe('ProfileStore Laden (Review 3, Befund 6)', () => {
  beforeEach(() => localStorage.clear());

  it('lädt ein gültiges Profil', () => {
    expect(load(valid).profile()).toEqual(valid);
  });

  it.each([42, 'x', [], { weightKg: 'x' }, { ...valid, goal: 'bulk' }])('stürzt bei %j nicht ab und liefert kein Profil', (raw) => {
    const store = load(raw);
    expect(store.profile()).toBeNull();
    expect(store.target()).toBeNull();
  });

  it('sichert ein verworfenes Profil in Quarantäne und entfernt es', () => {
    load({ weightKg: 'x' });
    expect(localStorage.getItem('nutritrack:profile')).toBeNull();
    expect(Object.keys(localStorage).some((k) => k.includes('quarantine'))).toBe(true);
  });
});
