import { describe, expect, it } from 'vitest';
import { validateProfileForm } from './profile-form';

const valid = { weightKg: 75, heightCm: 180, age: 30, rateKgPerWeek: 0.5 };

describe('validateProfileForm', () => {
  it('returns no errors for valid values', () => {
    expect(validateProfileForm(valid, true)).toEqual({});
  });

  it('reports every empty field as required', () => {
    const errors = validateProfileForm({ weightKg: null, heightCm: null, age: null, rateKgPerWeek: null }, false);
    expect(Object.keys(errors)).toEqual(['weightKg', 'heightCm', 'age']);
  });

  it('reports out-of-range values with the allowed range', () => {
    const errors = validateProfileForm({ ...valid, age: 5 }, false);
    expect(errors.age).toContain('14');
    expect(errors.weightKg).toBeUndefined();
  });

  it('ignores the rate when the goal needs none', () => {
    expect(validateProfileForm({ ...valid, rateKgPerWeek: null }, false)).toEqual({});
  });

  it('validates the rate when the goal needs one', () => {
    expect(validateProfileForm({ ...valid, rateKgPerWeek: 3 }, true).rateKgPerWeek).toBeDefined();
  });
});
