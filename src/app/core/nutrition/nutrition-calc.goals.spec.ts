import { beforeEach, describe, expect, it } from 'vitest';
import { UserProfile } from '../models';
import { NutritionCalcService } from './nutrition-calc.service';

describe('NutritionCalcService: Aufbau-Tempo und manuelle Ziele', () => {
  let svc: NutritionCalcService;
  const male: UserProfile = {
    weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
    goal: 'maintain', updatedAt: '2026-11-01T00:00:00.000Z',
  };

  beforeEach(() => {
    svc = new NutritionCalcService();
  });

  describe('Aufbau', () => {
    it('begrenzt das Tempo beim Zunehmen auf 0,5 % Körpergewicht pro Woche', () => {
      expect(svc.maxRateKgPerWeek(80, 'gain')).toBeCloseTo(0.4, 5);
      expect(svc.maxRateKgPerWeek(80, 'lose')).toBeCloseTo(0.8, 5);
      expect(svc.maxRateKgPerWeek(80)).toBeCloseTo(0.8, 5);
    });

    it('rechnet mit 7700 kcal/kg und deckelt den Überschuss', () => {
      expect(svc.dailyDeltaKcal(0.25, 80, 'gain')).toBe(275);
      // 0,75 kg/Woche wird auf 0,4 gedeckelt: 0,4 * 7700 / 7 = 440
      expect(svc.dailyDeltaKcal(0.75, 80, 'gain')).toBe(440);
      expect(svc.dailyDeltaKcal(0.75, 80, 'lose')).toBe(825);
    });

    it('liegt der Überschuss bei 75 kg und Maximalwunsch unter dem alten Wert von 825 kcal', () => {
      const surplus = svc.dailyTarget({ ...male, weightKg: 75, goal: 'gain', rateKgPerWeek: 0.75 }).kcal
        - svc.dailyTarget({ ...male, weightKg: 75 }).kcal;
      expect(surplus).toBeLessThan(450);
      expect(surplus).toBeGreaterThan(0);
    });

    it('nutzt ohne gespeichertes Tempo 0,25 kg beim Aufbau und 0,5 kg beim Abnehmen', () => {
      const base = svc.dailyTarget(male).kcal;
      expect(svc.dailyTarget({ ...male, goal: 'gain' }).kcal - base).toBe(275);
      expect(base - svc.dailyTarget({ ...male, goal: 'lose' }).kcal).toBe(550);
    });
  });

  describe('manuelles Ziel', () => {
    it('ersetzt das Kalorienziel und rechnet Makros daraus', () => {
      const t = svc.dailyTarget({ ...male, manualKcal: 2400 });
      expect(t.kcal).toBe(2400);
      expect(t.fatG).toBe(Math.round((2400 * 0.3) / 9));
      expect(t.sugarG).toBe(60);
    });

    it('rechnet das Eiweißziel aus g/kg mal Körpergewicht', () => {
      expect(svc.dailyTarget({ ...male, manualProteinGPerKg: 2.2 }).proteinG).toBe(176);
    });

    it('lässt kcal und Eiweiß unabhängig voneinander automatisch', () => {
      const auto = svc.dailyTarget(male);
      expect(svc.dailyTarget({ ...male, manualKcal: 2400 }).proteinG).toBe(auto.proteinG);
      expect(svc.dailyTarget({ ...male, manualProteinGPerKg: 2 }).kcal).toBe(auto.kcal);
    });

    it('wendet die Mindestzufuhr auf manuelle Werte nicht an', () => {
      const lose = { ...male, goal: 'lose' as const, manualKcal: 1100 };
      expect(svc.dailyTarget(lose).kcal).toBe(1100);
      expect(svc.isMinKcalApplied(lose)).toBe(false);
    });

    it('ignoriert unbrauchbare gespeicherte Werte', () => {
      const auto = svc.dailyTarget(male);
      expect(svc.dailyTarget({ ...male, manualKcal: 50, manualProteinGPerKg: 9 })).toEqual(auto);
    });

    it('nennt die Mindestzufuhr je Geschlecht für Warnhinweise', () => {
      expect(svc.minimumKcal({ ...male, sex: 'female' })).toBe(1200);
      expect(svc.minimumKcal(male)).toBe(1500);
    });
  });
});
