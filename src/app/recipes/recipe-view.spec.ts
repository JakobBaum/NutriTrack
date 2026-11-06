import { describe, expect, it } from 'vitest';
import { NutritionFacts } from '../core/models';
import {
  APPROX_UNITS,
  countMissingFacts,
  hasApproxUnits,
  isAiOrigin,
  isUnknownUnit,
  isValidYield,
  lowerBoundNote,
  optionalGramsLabel,
  scaleFacts,
  lowerBoundPrefix,
  missingFactsLabel,
  servingsLabel,
  totalWeightG,
} from './recipe-view';

const facts: NutritionFacts = { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, basis: 'per100g' };

describe('recipe-view', () => {
  it('formats half servings with a decimal comma', () => {
    expect(servingsLabel(2.5)).toBe('2,5 Portionen');
    expect(servingsLabel(1)).toBe('1 Portion');
  });

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

describe('recipe-view — Ergibt/Essen/Hinweise', () => {
  it('akzeptiert Ergibt nur ab 1 in ganzen oder halben Schritten', () => {
    expect(isValidYield(1)).toBe(true);
    expect(isValidYield(2.5)).toBe(true);
    expect(isValidYield(0.5)).toBe(false);
    expect(isValidYield(2.3)).toBe(false);
    expect(isValidYield(null)).toBe(false);
  });

  it('skaliert Nährwerte auf gegessene Portionen ohne das Original zu ändern', () => {
    const base: NutritionFacts = { kcal: 300, proteinG: 10, carbsG: 20, fatG: 5, fiberG: 3, basis: 'perPortion' };
    const half = scaleFacts(base, 0.5);
    expect(half).toMatchObject({ kcal: 150, proteinG: 5, carbsG: 10, fatG: 2.5, fiberG: 1.5 });
    expect(half.sugarG).toBeUndefined();
    expect(base.kcal).toBe(300);
  });

  it('zeigt "keine Angabe" statt 0 g bei fehlenden Zutatenwerten', () => {
    expect(optionalGramsLabel(undefined, 0)).toBe('keine Angabe');
    expect(optionalGramsLabel(0, 2)).toBe('keine Angabe');
    expect(optionalGramsLabel(0, 0)).toBe('0 g');
    expect(optionalGramsLabel(4.5, 1)).toBe('4,5 g');
  });

  it('erklärt die Untergrenze einmalig', () => {
    expect(lowerBoundNote(0)).toBe('');
    expect(lowerBoundNote(1)).toBe('≥ Mindestwerte: 1 Zutat ohne Werte');
  });

  it('erkennt unbekannte Einheiten', () => {
    expect(isUnknownUnit('EL', ['g', 'EL'])).toBe(false);
    expect(isUnknownUnit('zehe', ['g', 'EL'])).toBe(true);
    expect(isUnknownUnit('', ['g'])).toBe(false);
  });
});
