import { describe, expect, it, beforeEach } from 'vitest';
import { NutritionCalcService } from './nutrition-calc.service';
import { NutritionFacts, UserProfile } from '../models';

describe('NutritionCalcService', () => {
  let svc: NutritionCalcService;

  const male: UserProfile = {
    weightKg: 80,
    heightCm: 180,
    age: 30,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'maintain',
    updatedAt: '2026-10-13T00:00:00.000Z',
  };

  beforeEach(() => {
    svc = new NutritionCalcService();
  });

  it('berechnet BMR nach Mifflin-St Jeor (männlich)', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(svc.basalMetabolicRate(male)).toBe(1780);
  });

  it('berechnet BMR nach Mifflin-St Jeor (weiblich)', () => {
    const female: UserProfile = { ...male, sex: 'female' };
    // 1775 - 161 = 1614
    expect(svc.basalMetabolicRate(female)).toBe(1614);
  });

  it('wendet den Aktivitätsfaktor für TDEE an', () => {
    // 1780 * 1.55 = 2759
    expect(svc.totalDailyEnergy(male)).toBeCloseTo(2759, 0);
  });

  it('erzeugt bei maintain ein Ziel ohne Defizit', () => {
    const t = svc.dailyTarget(male);
    expect(t.kcal).toBe(2759);
    expect(t.proteinG).toBe(Math.round(1.6 * 80)); // 128
  });

  it('zieht bei lose ein tägliches Defizit ab', () => {
    const t = svc.dailyTarget({ ...male, goal: 'lose', rateKgPerWeek: 0.5 });
    // delta = 0.5*7700/7 = 550 → 2759 - 550 = 2209
    expect(t.kcal).toBe(2209);
  });

  it('respektiert die sichere Untergrenze', () => {
    const tiny: UserProfile = {
      ...male,
      weightKg: 45,
      heightCm: 150,
      age: 70,
      sex: 'female',
      activityLevel: 'sedentary',
      goal: 'lose',
      rateKgPerWeek: 1,
    };
    const t = svc.dailyTarget(tiny);
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });

  it('die Makro-Energie ergibt ungefähr die kcal', () => {
    const t = svc.dailyTarget(male);
    const macroKcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    expect(Math.abs(macroKcal - t.kcal)).toBeLessThanOrEqual(20);
  });

  it('skaliert per-100g-Werte auf Gramm', () => {
    const facts: NutritionFacts = {
      kcal: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 8,
      basis: 'per100g',
    };
    const scaled = svc.scaleToGrams(facts, 250);
    expect(scaled.kcal).toBe(500);
    expect(scaled.proteinG).toBe(25);
    expect(scaled.basis).toBe('perPortion');
    expect(scaled.portionG).toBe(250);
  });

  it('summiert mehrere Nährwert-Sätze', () => {
    const a: NutritionFacts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1, basis: 'perPortion' };
    const b: NutritionFacts = { kcal: 150, proteinG: 8, carbsG: 12, fatG: 4, fiberG: 2, basis: 'perPortion' };
    const total = svc.sum([a, b]);
    expect(total.kcal).toBe(250);
    expect(total.proteinG).toBe(13);
    expect(total.fiberG).toBe(3);
  });
});
