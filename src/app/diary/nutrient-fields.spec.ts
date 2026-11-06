import { EMPTY_FIELDS } from './diary-helpers';
import { hasMacros, kcalFromMacros, withDerivedKcal } from './nutrient-fields';

describe('kcalFromMacros', () => {
  it('computes 4 protein + 4 carbs + 9 fat', () => {
    expect(kcalFromMacros({ proteinG: 10, carbsG: 20, fatG: 5 })).toBe(165);
  });

  it('treats empty fields as zero and rounds', () => {
    expect(kcalFromMacros({ proteinG: null, carbsG: 1.1, fatG: null })).toBe(4);
  });
});

describe('withDerivedKcal', () => {
  it('keeps the fields when no macro is entered', () => {
    const fields = { ...EMPTY_FIELDS, kcal: 220 };
    expect(hasMacros(fields)).toBe(false);
    expect(withDerivedKcal(fields)).toBe(fields);
  });

  it('replaces kcal when a macro is entered', () => {
    const next = withDerivedKcal({ ...EMPTY_FIELDS, kcal: 999, fatG: 10 });
    expect(next.kcal).toBe(90);
  });
});
