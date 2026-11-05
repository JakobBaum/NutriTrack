import { NutritionFacts } from '../core/models';
import {
  EMPTY_FIELDS,
  factsFromFields,
  fieldsFromFacts,
  isIsoDate,
  isMealType,
  mealForHour,
  mealLabel,
  scaleFacts,
  toNumberOrNull,
} from './diary-helpers';

const OATS_PER_100G: NutritionFacts = {
  kcal: 372,
  proteinG: 13.5,
  carbsG: 58.7,
  fatG: 7,
  fiberG: 10,
  basis: 'per100g',
};

describe('mealForHour', () => {
  it('picks breakfast in the morning', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(10)).toBe('breakfast');
  });

  it('picks lunch around midday', () => {
    expect(mealForHour(11)).toBe('lunch');
    expect(mealForHour(14)).toBe('lunch');
  });

  it('picks snack in the afternoon and dinner in the evening', () => {
    expect(mealForHour(16)).toBe('snack');
    expect(mealForHour(19)).toBe('dinner');
  });

  it('falls back to snack late at night', () => {
    expect(mealForHour(23)).toBe('snack');
    expect(mealForHour(2)).toBe('snack');
  });
});

describe('meal helpers', () => {
  it('validates meal types', () => {
    expect(isMealType('lunch')).toBe(true);
    expect(isMealType('brunch')).toBe(false);
    expect(isMealType(null)).toBe(false);
  });

  it('returns German labels', () => {
    expect(mealLabel('breakfast')).toBe('Frühstück');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-11-05')).toBe(true);
    expect(isIsoDate('05.11.2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('scaleFacts', () => {
  it('scales per-100g values to the entered amount and marks them perPortion', () => {
    const scaled = scaleFacts(OATS_PER_100G, 1.5);

    expect(scaled.kcal).toBe(558);
    expect(scaled.proteinG).toBe(20.3);
    expect(scaled.fiberG).toBe(15);
    expect(scaled.sugarG).toBeUndefined();
    expect(scaled.basis).toBe('perPortion');
  });

  it('does not mutate the base facts', () => {
    const copy = { ...OATS_PER_100G };

    scaleFacts(OATS_PER_100G, 2);

    expect(OATS_PER_100G).toEqual(copy);
  });
});

describe('fields <-> facts', () => {
  it('round-trips facts through form fields', () => {
    const facts = scaleFacts(OATS_PER_100G, 1);

    const back = factsFromFields(fieldsFromFacts(facts));

    expect(back?.kcal).toBe(372);
    expect(back?.proteinG).toBe(13.5);
    expect(back?.basis).toBe('perPortion');
  });

  it('returns null when calories are missing', () => {
    expect(factsFromFields(EMPTY_FIELDS)).toBeNull();
  });

  it('returns null for negative calories', () => {
    expect(factsFromFields({ ...EMPTY_FIELDS, kcal: -5 })).toBeNull();
  });

  it('treats empty macro fields as zero', () => {
    const facts = factsFromFields({ ...EMPTY_FIELDS, kcal: 120.4 });

    expect(facts).toMatchObject({ kcal: 120, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('toNumberOrNull', () => {
  it('parses numbers, numeric strings and decimal commas', () => {
    expect(toNumberOrNull(150)).toBe(150);
    expect(toNumberOrNull('12.5')).toBe(12.5);
    expect(toNumberOrNull('12,5')).toBe(12.5);
  });

  it('returns null for empty or invalid input', () => {
    expect(toNumberOrNull('')).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
  });
});
