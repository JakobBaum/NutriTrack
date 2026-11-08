import { describe, expect, it } from 'vitest';
import { targetWeightError, validateProfileForm } from './profile-form';

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

describe('targetWeightError', () => {
  it('accepts an empty target (optional)', () => {
    expect(targetWeightError(null, 80, 'lose', 180)).toBeNull();
  });

  it('accepts a lower target when losing and a higher one when gaining', () => {
    expect(targetWeightError(72, 80, 'lose', 180)).toBeNull();
    expect(targetWeightError(85, 80, 'gain', 180)).toBeNull();
  });

  it('rejects a target on the wrong side of the current weight', () => {
    expect(targetWeightError(85, 80, 'lose', 180)).toContain('unter');
    expect(targetWeightError(75, 80, 'gain', 180)).toContain('über');
  });

  it('allows any target when maintaining', () => {
    expect(targetWeightError(82, 80, 'maintain', 180)).toBeNull();
  });

  it('rejects values outside 30 to 300 kg and non-numbers', () => {
    expect(targetWeightError(20, 80, 'maintain', 180)).toContain('30');
    expect(targetWeightError(Number.NaN, 80, 'maintain', 180)).toBeDefined();
  });

  it('rejects a target in the underweight range (BMI under 18.5)', () => {
    expect(targetWeightError(55, 80, 'lose', 180)).toContain('Untergewicht');
    expect(targetWeightError(61, 80, 'lose', 180)).toBeNull();
  });

  it('skips the BMI and direction checks while weight or height are missing', () => {
    expect(targetWeightError(55, null, 'lose', null)).toBeNull();
  });
});
