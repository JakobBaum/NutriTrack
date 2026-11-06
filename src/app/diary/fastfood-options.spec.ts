import { describe, expect, it } from 'vitest';
import {
  FASTFOOD_CHAINS, OTHER_RESTAURANT, defaultKcalBudget, preferenceValue, resolveRestaurant, restaurantChoice, snapToRange,
  MONEY_RANGE,
} from './fastfood-options';

describe('fastfood-options', () => {
  it('clamps the default kcal budget into the slider range', () => {
    expect(defaultKcalBudget(0)).toBe(200);
    expect(defaultKcalBudget(5000)).toBe(1500);
    expect(defaultKcalBudget(823)).toBe(800);
  });

  it('falls back to the maximum when remaining kcal is not finite', () => {
    expect(defaultKcalBudget(Number.NaN)).toBe(1500);
  });

  it('snaps money to half euros inside 3..30', () => {
    expect(snapToRange(7.3, MONEY_RANGE)).toBe(7.5);
    expect(snapToRange(1, MONEY_RANGE)).toBe(3);
    expect(snapToRange(99, MONEY_RANGE)).toBe(30);
  });

  it('maps known chains to themselves and unknown to other', () => {
    expect(restaurantChoice(FASTFOOD_CHAINS[0])).toBe(FASTFOOD_CHAINS[0]);
    expect(restaurantChoice('Dönerladen')).toBe(OTHER_RESTAURANT);
  });

  it('resolves the restaurant name from choice or custom text', () => {
    expect(resolveRestaurant('KFC', 'x')).toBe('KFC');
    expect(resolveRestaurant(OTHER_RESTAURANT, '  Dönerladen ')).toBe('Dönerladen');
  });

  it('keeps known preference strings and falls back to the first', () => {
    expect(preferenceValue('günstig')).toBe('günstig');
    expect(preferenceValue('irgendwas')).toBe('viel Protein');
  });
});
