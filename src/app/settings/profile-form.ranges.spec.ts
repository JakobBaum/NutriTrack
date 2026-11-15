import { describe, expect, it } from 'vitest';
import { PROFILE_LOAD_RANGES } from '../core/state/profile-sanitize';
import { RANGES, TARGET_RANGE } from './profile-form';

/**
 * Das Formular darf nie ein Profil zulassen, das `sanitizeProfile` beim nächsten Laden verwirft
 * (Review-Befund 12): seine Grenzen müssen innerhalb der Ladegrenzen liegen.
 */
describe('Profilformular bleibt innerhalb der Ladegrenzen', () => {
  it.each(['weightKg', 'heightCm', 'age', 'rateKgPerWeek'] as const)('%s', (field) => {
    expect(RANGES[field].min).toBeGreaterThanOrEqual(PROFILE_LOAD_RANGES[field].min);
    expect(RANGES[field].max).toBeLessThanOrEqual(PROFILE_LOAD_RANGES[field].max);
  });

  it('Zielgewicht', () => {
    expect(TARGET_RANGE.min).toBeGreaterThanOrEqual(PROFILE_LOAD_RANGES.weightKg.min);
    expect(TARGET_RANGE.max).toBeLessThanOrEqual(PROFILE_LOAD_RANGES.weightKg.max);
  });
});
