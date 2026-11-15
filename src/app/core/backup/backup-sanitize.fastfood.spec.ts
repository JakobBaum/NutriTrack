import { describe, expect, it } from 'vitest';
import { sanitizeBackupData } from './backup-sanitize';

const profile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

describe('Backup und Fastfood-Land im Profil', () => {
  it('trägt ein gültiges Land im Profil mit', () => {
    const result = sanitizeBackupData({ profile: { ...profile, fastfoodCountry: 'Italien' } });
    expect((result.data['profile'] as { fastfoodCountry?: string }).fastfoodCountry).toBe('Italien');
  });

  it('ersetzt ein unbekanntes Land durch die Vorgabe', () => {
    const result = sanitizeBackupData({ profile: { ...profile, fastfoodCountry: 'Atlantis' } });
    expect((result.data['profile'] as { fastfoodCountry?: string }).fastfoodCountry).toBe('Österreich');
  });

  it('lässt ein altes Backup ohne Land unverändert, damit das alte Land aus den Einstellungen übernommen werden kann', () => {
    const result = sanitizeBackupData({ profile, 'app-settings': { unitSystem: 'metric', fastfoodCountry: 'Italien' } });
    expect(Object.keys(result.data['profile'] as object)).not.toContain('fastfoodCountry');
    expect(result.data['app-settings']).toEqual({ unitSystem: 'metric', fastfoodCountry: 'Italien' });
  });
});
