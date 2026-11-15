import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { UserProfile } from '../models';
import { legacyFastfoodCountry, sanitizeProfile, withLegacyFastfoodCountry } from './profile-sanitize';
import { StorageService } from '../storage/storage.service';
import { ProfileStore } from './profile.store';

const valid = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

describe('sanitizeProfile Fastfood-Land', () => {
  it('behält ein Land aus der Liste', () => {
    expect(sanitizeProfile({ ...valid, fastfoodCountry: 'Italien' })?.fastfoodCountry).toBe('Italien');
  });

  it.each(['Atlantis', '', 7, null, ['Italien']])('ersetzt %j durch die Vorgabe Österreich', (value) => {
    expect(sanitizeProfile({ ...valid, fastfoodCountry: value })?.fastfoodCountry).toBe('Österreich');
  });

  it('lässt das Feld weg, wenn es fehlt (nichts wird erfunden)', () => {
    expect(Object.keys(sanitizeProfile(valid) as object)).not.toContain('fastfoodCountry');
  });
});

describe('Übernahme des alten Fastfood-Lands', () => {
  const base = (): UserProfile => sanitizeProfile(valid) as UserProfile;

  it('übernimmt ein altes gültiges Land, wenn das Profil keins hat', () => {
    expect(withLegacyFastfoodCountry(base(), 'Schweiz')).toEqual({ ...base(), fastfoodCountry: 'Schweiz' });
  });

  it('verändert das übergebene Profil nicht', () => {
    const p = base();
    withLegacyFastfoodCountry(p, 'Schweiz');
    expect(p.fastfoodCountry).toBeUndefined();
  });

  it('überschreibt ein vorhandenes Profil-Land nie (idempotent)', () => {
    const p = { ...base(), fastfoodCountry: 'Österreich' };
    expect(withLegacyFastfoodCountry(p, 'Schweiz')).toBe(p);
  });

  it.each(['Atlantis', 'Österreich', undefined, null, 5])('ignoriert den alten Wert %j', (legacy) => {
    const p = base();
    expect(withLegacyFastfoodCountry(p, legacy)).toBe(p);
  });

  it('liest das alte Land nur, wenn es gültig und nicht die Vorgabe ist', () => {
    expect(legacyFastfoodCountry('Italien')).toBe('Italien');
    expect(legacyFastfoodCountry('Österreich')).toBeNull();
    expect(legacyFastfoodCountry('Mordor')).toBeNull();
  });
});

describe('ProfileStore Fastfood-Land (Übernahme aus den Einstellungen)', () => {
  const stored = () => {
    TestBed.inject(StorageService).flush();
    return JSON.parse(localStorage.getItem('nutritrack:profile') ?? 'null');
  };

  function loadWithLegacy(profile: unknown, legacy: unknown): ProfileStore {
    localStorage.clear();
    localStorage.setItem('nutritrack:profile', JSON.stringify(profile));
    localStorage.setItem('nutritrack:app-settings', JSON.stringify({ unitSystem: 'metric', fastfoodCountry: legacy }));
    TestBed.resetTestingModule();
    return TestBed.inject(ProfileStore);
  }

  beforeEach(() => localStorage.clear());

  it('liefert ohne Profil und ohne alten Wert Österreich', () => {
    TestBed.resetTestingModule();
    expect(TestBed.inject(ProfileStore).fastfoodCountry()).toBe('Österreich');
  });

  it('übernimmt das alte Land einmalig ins Profil und speichert es', () => {
    const store = loadWithLegacy(valid, 'Italien');
    expect(store.profile()?.fastfoodCountry).toBe('Italien');
    expect(store.fastfoodCountry()).toBe('Italien');
    expect(stored().fastfoodCountry).toBe('Italien');
  });

  it('ist idempotent: ein zweites Laden ändert nichts', () => {
    loadWithLegacy(valid, 'Italien');
    const first = stored();
    TestBed.resetTestingModule();
    const again = TestBed.inject(ProfileStore);
    expect(again.profile()).toEqual(first);
    expect(stored()).toEqual(first);
  });

  it('lässt ein bewusst gewähltes Profil-Land gegenüber dem alten Wert gelten', () => {
    const store = loadWithLegacy({ ...valid, fastfoodCountry: 'Österreich' }, 'Italien');
    expect(store.fastfoodCountry()).toBe('Österreich');
  });

  it('wird nach dem Ändern im Profil nicht mehr vom alten Wert überschrieben', () => {
    const store = loadWithLegacy(valid, 'Italien');
    store.setProfile({ ...(store.profile() as UserProfile), fastfoodCountry: 'USA' });
    TestBed.resetTestingModule();
    expect(TestBed.inject(ProfileStore).fastfoodCountry()).toBe('USA');
  });

  it('ignoriert einen unbekannten alten Wert', () => {
    expect(loadWithLegacy(valid, 'Mordor').fastfoodCountry()).toBe('Österreich');
  });

  it('nutzt ohne Profil den alten Wert als Land, bis ein Profil gespeichert wird', () => {
    localStorage.clear();
    localStorage.setItem('nutritrack:app-settings', JSON.stringify({ fastfoodCountry: 'Schweiz' }));
    TestBed.resetTestingModule();
    expect(TestBed.inject(ProfileStore).fastfoodCountry()).toBe('Schweiz');
  });
});
