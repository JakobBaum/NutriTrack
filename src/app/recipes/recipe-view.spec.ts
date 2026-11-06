import { describe, expect, it } from 'vitest';
import { NutritionFacts } from '../core/models';
import {
  APPROX_UNITS,
  countMissingFacts,
  hasApproxUnits,
  isAiOrigin,
  lowerBoundPrefix,
  missingFactsLabel,
  servingsLabel,
  totalWeightG,
} from './recipe-view';

const facts: NutritionFacts = { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, basis: 'per100g' };

describe('recipe-view', () => {
  it('counts only ingredients without facts', () => {
    expect(countMissingFacts([{ facts }, { facts: undefined }, {}])).toBe(2);
  });

  it('returns 0 when every ingredient has facts', () => {
    expect(countMissingFacts([{ facts }])).toBe(0);
  });

  it('uses singular and plural in the missing-facts label', () => {
    expect(missingFactsLabel(1)).toBe('1 Zutat ohne Werte');
    expect(missingFactsLabel(3)).toBe('3 Zutaten ohne Werte');
  });

  it('prefixes a lower bound only when values are missing', () => {
    expect(lowerBoundPrefix(0)).toBe('');
    expect(lowerBoundPrefix(2)).toBe('≥ ');
  });

  it('flags non-own origins as AI estimates', () => {
    expect(isAiOrigin('own')).toBe(false);
    expect(isAiOrigin(undefined)).toBe(false);
    expect(isAiOrigin('url')).toBe(true);
    expect(isAiOrigin('photo')).toBe(true);
  });

  it('sums weight with exact and approximate units', () => {
    const weight = totalWeightG([
      { amount: 200, unit: 'g' },
      { amount: 1, unit: 'kg' },
      { amount: 2, unit: 'EL' },
      { amount: 3, unit: 'unbekannt' },
    ]);
    expect(weight).toBe(1230);
  });

  it('detects approximate units', () => {
    expect(hasApproxUnits([{ unit: 'g' }, { unit: 'ml' }])).toBe(false);
    expect(hasApproxUnits([{ unit: 'g' }, { unit: 'TL' }])).toBe(true);
  });

  it('lists only approximate units for the explanation', () => {
    const units = APPROX_UNITS.map((u) => u.unit);
    expect(units).toContain('EL');
    expect(units).not.toContain('g');
  });

  it('uses singular for one serving', () => {
    expect(servingsLabel(1)).toBe('1 Portion');
    expect(servingsLabel(4)).toBe('4 Portionen');
  });
});
