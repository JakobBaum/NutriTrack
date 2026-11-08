import { describe, expect, it, beforeEach } from 'vitest';
import { NutritionCalcService } from './nutrition-calc.service';
import { NutritionFacts, UserProfile } from '../models';

// Randfälle der Bedarfsrechnung (BMR/TDEE/Ziel/Mindestzufuhr) und Skalierung.
describe('NutritionCalcService — Randfälle', () => {
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

  describe('BMR / TDEE', () => {
    it('nutzt für divers den Mittelwert (−78)', () => {
      // 1775 - 78 = 1697
      expect(svc.basalMetabolicRate({ ...male, sex: 'diverse' })).toBe(1697);
    });

    it('wendet alle Aktivitätsfaktoren an', () => {
      expect(svc.totalDailyEnergy({ ...male, activityLevel: 'sedentary' })).toBeCloseTo(2136, 5);
      expect(svc.totalDailyEnergy({ ...male, activityLevel: 'light' })).toBeCloseTo(2447.5, 5);
      expect(svc.totalDailyEnergy({ ...male, activityLevel: 'active' })).toBeCloseTo(3070.5, 5);
      expect(svc.totalDailyEnergy({ ...male, activityLevel: 'veryActive' })).toBeCloseTo(3382, 5);
    });

    it('bleibt bei sehr großen Werten endlich', () => {
      const t = svc.dailyTarget({ ...male, weightKg: 1e6, heightCm: 1e5 });
      expect(Number.isFinite(t.kcal)).toBe(true);
      expect(t.kcal).toBeGreaterThan(1e6);
    });

    it('liefert bei Gewicht 0 dennoch ein Ziel ≥ Mindestzufuhr und 0 g Protein', () => {
      const t = svc.dailyTarget({ ...male, weightKg: 0 });
      expect(t.kcal).toBe(1519); // 980 * 1.55 = 1519 > 1500
      expect(t.proteinG).toBe(0);
    });

    // BUG: NaN-Gewicht (z. B. leeres Formularfeld) → Math.max(NaN, min) = NaN.
    // nutrition-calc.service.ts:62 — erwartet: Mindestzufuhr (1500), tatsächlich: NaN.
    it('fällt bei NaN-Gewicht auf die Mindestzufuhr zurück', () => {
      expect(svc.dailyTarget({ ...male, weightKg: Number.NaN }).kcal).toBe(1500);
    });
  });

  describe('Ziel-Anpassung', () => {
    it('addiert bei gain den Überschuss', () => {
      // 0.25 * 7700 / 7 = 275 → 2759 + 275
      expect(svc.dailyTarget({ ...male, goal: 'gain', rateKgPerWeek: 0.25 }).kcal).toBe(3034);
    });

    it('nutzt bei negativer Rate den Betrag', () => {
      expect(svc.dailyTarget({ ...male, goal: 'lose', rateKgPerWeek: -0.5 }).kcal).toBe(2209);
    });

    it('nutzt 0,5 kg/Woche als Standard, wenn keine Rate gesetzt ist', () => {
      expect(svc.dailyTarget({ ...male, goal: 'lose' }).kcal).toBe(2209);
    });

    it('zieht bei Rate 0 nichts ab', () => {
      expect(svc.dailyTarget({ ...male, goal: 'lose', rateKgPerWeek: 0 }).kcal).toBe(2759);
    });

    it('ignoriert die Rate bei maintain', () => {
      expect(svc.dailyTarget({ ...male, rateKgPerWeek: 1 }).kcal).toBe(2759);
    });

    it('nutzt Protein-Faktor 2,0 bei gain und 1,8 bei lose', () => {
      expect(svc.dailyTarget({ ...male, goal: 'gain' }).proteinG).toBe(160);
      expect(svc.dailyTarget({ ...male, goal: 'lose' }).proteinG).toBe(144);
    });

    it('berechnet Ballaststoffe (14 g/1000 kcal) und Zucker-Obergrenze (10 %)', () => {
      const t = svc.dailyTarget(male);
      expect(t.fiberG).toBe(39); // 2.759 * 14 = 38.6
      expect(t.sugarG).toBe(69); // 275.9 / 4 = 68.98
    });
  });

  describe('Mindestzufuhr', () => {
    const tiny: UserProfile = {
      weightKg: 40, heightCm: 150, age: 80, sex: 'male',
      activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 1,
      updatedAt: '2026-10-13T00:00:00.000Z',
    };

    it('hebt Männer auf 1500 kcal an', () => {
      expect(svc.isMinKcalApplied(tiny)).toBe(true);
      expect(svc.dailyTarget(tiny).kcal).toBe(1500);
    });

    it('hebt divers auf 1350 kcal an', () => {
      expect(svc.dailyTarget({ ...tiny, sex: 'diverse' }).kcal).toBe(1350);
    });

    it('nutzt 1350 kcal für ein unbekanntes Geschlecht', () => {
      const unknown = { ...tiny, sex: 'x' } as unknown as UserProfile;
      expect(svc.dailyTarget(unknown).kcal).toBe(1350);
    });

    it('rechnet Eiweiß bei extremem BMI mit Referenzgewicht, Kohlenhydrate nie negativ', () => {
      const heavy: UserProfile = {
        ...tiny, weightKg: 150, heightCm: 100, age: 90, sex: 'female',
      };
      const t = svc.dailyTarget(heavy);
      expect(t.kcal).toBe(1200);
      expect(t.proteinG).toBe(45); // 1,8 * 25 kg (BMI 25 bei 1 m)
      expect(t.carbsG).toBe(165);
    });
  });

  describe('Skalierung', () => {
    const portion: NutritionFacts = {
      kcal: 150, proteinG: 1.25, carbsG: 20, fatG: 5, basis: 'perPortion', portionG: 30,
    };

    it('skaliert perPortion-Werte über portionG', () => {
      const s = svc.scaleToGrams(portion, 60);
      expect(s.kcal).toBe(300);
      expect(s.proteinG).toBe(2.5);
      expect(s.portionG).toBe(60);
    });

    it('nimmt 100 g als Bezug, wenn perPortion ohne portionG vorliegt', () => {
      const s = svc.scaleToGrams({ ...portion, portionG: undefined }, 50);
      expect(s.kcal).toBe(75);
    });

    it('liefert bei 0 g lauter Nullen', () => {
      const s = svc.scaleToGrams({ ...portion, basis: 'per100g' }, 0);
      expect(s.kcal).toBe(0);
      expect(s.proteinG).toBe(0);
      expect(s.portionG).toBe(0);
    });

    it('rundet Makros auf eine Nachkommastelle und lässt fehlende optionale Werte weg', () => {
      const s = svc.scaleToGrams({ ...portion, basis: 'per100g' }, 100);
      expect(s.proteinG).toBe(1.3);
      expect(s.fiberG).toBeUndefined();
      expect(s.sugarG).toBeUndefined();
      expect(s.saltG).toBeUndefined();
    });

    it('behandelt fehlende kcal als 0', () => {
      const s = svc.scaleToGrams({ ...portion, kcal: Number.NaN, basis: 'per100g' }, 200);
      expect(s.kcal).toBe(0);
    });

    // BUG: portionG = 0 wird nicht abgefangen (`?? 100` greift nur bei null/undefined)
    // → Division durch 0. nutrition-calc.service.ts:107 — erwartet: endlicher Wert, tatsächlich: Infinity.
    it('liefert bei portionG = 0 endliche Werte', () => {
      const s = svc.scaleToGrams({ ...portion, portionG: 0 }, 50);
      expect(Number.isFinite(s.kcal)).toBe(true);
    });

    it('skaliert auf Portionen inkl. Gramm', () => {
      const s = svc.scaleToPortions({ ...portion, portionG: 40 }, 2.5);
      expect(s.kcal).toBe(375);
      expect(s.portionG).toBe(100);
    });

    it('lässt portionG weg, wenn keine Portionsgröße oder 0 Portionen', () => {
      expect(svc.scaleToPortions({ ...portion, portionG: undefined }, 2).portionG).toBeUndefined();
      const zero = svc.scaleToPortions(portion, 0);
      expect(zero.portionG).toBeUndefined();
      expect(zero.kcal).toBe(0);
    });

    it('summiert eine leere Liste zu Nullen und behandelt fehlende/NaN-Werte als 0', () => {
      expect(svc.sum([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 });
      const t = svc.sum([{ kcal: Number.NaN, proteinG: 2, carbsG: 0, fatG: 0, basis: 'per100g' }]);
      expect(t.kcal).toBe(0);
      expect(t.fiberG).toBe(0);
      expect(t.proteinG).toBe(2);
    });
  });
});
