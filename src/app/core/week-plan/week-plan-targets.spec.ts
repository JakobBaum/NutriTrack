import { describe, expect, it } from 'vitest';
import { mealMaxCalories, mealMinProtein, proteinSteps } from './week-plan-targets';

describe('mealMaxCalories', () => {
  it('splits the daily target 25/35/30/10 percent per meal', () => {
    expect(mealMaxCalories(2000, 'breakfast')).toBe(500);
    expect(mealMaxCalories(2000, 'lunch')).toBe(700);
    expect(mealMaxCalories(2000, 'dinner')).toBe(600);
    expect(mealMaxCalories(2000, 'snack')).toBe(200);
  });

  it('returns null without a usable daily target', () => {
    expect(mealMaxCalories(null, 'lunch')).toBeNull();
    expect(mealMaxCalories(0, 'lunch')).toBeNull();
    expect(mealMaxCalories(Number.NaN, 'lunch')).toBeNull();
  });
});

describe('mealMinProtein', () => {
  it('uses the meal share of the profile protein goal', () => {
    expect(mealMinProtein(120, 'breakfast')).toBe(30);
    expect(mealMinProtein(120, 'snack')).toBe(12);
  });

  it('falls back to 15/30/30/10 g without a protein goal', () => {
    expect(mealMinProtein(null, 'breakfast')).toBe(15);
    expect(mealMinProtein(null, 'lunch')).toBe(30);
    expect(mealMinProtein(undefined, 'dinner')).toBe(30);
    expect(mealMinProtein(0, 'snack')).toBe(10);
  });

  it('follows the daily goal without a fixed cap (the goal itself is capped at 2.2 g/kg)', () => {
    // 80 kg * 2,2 = 176 g -> Mittag 35 % = 62 g
    expect(mealMinProtein(176, 'lunch')).toBe(62);
    expect(mealMinProtein(400, 'lunch')).toBe(140);
  });
});

describe('proteinSteps', () => {
  it('relaxes full, half, then none', () => {
    expect(proteinSteps(30)).toEqual([30, 15, null]);
    expect(proteinSteps(1)).toEqual([1, 1, null]);
  });
});
