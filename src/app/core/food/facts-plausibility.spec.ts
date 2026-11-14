import { isPlausiblePer100g } from './facts-plausibility';
import { NutritionFacts } from '../models';

const facts = (over: Partial<NutritionFacts> = {}): NutritionFacts => ({
  kcal: 250, proteinG: 10, carbsG: 30, fatG: 8, basis: 'per100g', ...over,
});

describe('isPlausiblePer100g', () => {
  it('akzeptiert übliche Werte', () => {
    expect(isPlausiblePer100g(facts())).toBe(true);
  });

  it('akzeptiert reines Fett (900 kcal, 100 g Fett)', () => {
    expect(isPlausiblePer100g(facts({ kcal: 900, proteinG: 0, carbsG: 0, fatG: 100 }))).toBe(true);
  });

  it('verwirft mehr Kalorien, als 100 g Fett liefern können', () => {
    expect(isPlausiblePer100g(facts({ kcal: 9999 }))).toBe(false);
  });

  it('verwirft einen Makrowert über 100 g je 100 g', () => {
    expect(isPlausiblePer100g(facts({ proteinG: 250 }))).toBe(false);
  });

  it('verwirft eine Makrosumme deutlich über 100 g', () => {
    expect(isPlausiblePer100g(facts({ proteinG: 60, carbsG: 60, fatG: 20 }))).toBe(false);
  });

  it('verwirft Zucker oder Ballaststoffe über 100 g', () => {
    expect(isPlausiblePer100g(facts({ sugarG: 400 }))).toBe(false);
    expect(isPlausiblePer100g(facts({ fiberG: 101 }))).toBe(false);
  });

  it('verwirft nicht endliche Werte', () => {
    expect(isPlausiblePer100g(facts({ kcal: Number.NaN }))).toBe(false);
    expect(isPlausiblePer100g(facts({ fatG: Number.POSITIVE_INFINITY }))).toBe(false);
  });

  it('lässt kleine Rundungsüberschreitungen der Makrosumme zu', () => {
    expect(isPlausiblePer100g(facts({ proteinG: 1, carbsG: 99.8, fatG: 0.5 }))).toBe(true);
  });
});
