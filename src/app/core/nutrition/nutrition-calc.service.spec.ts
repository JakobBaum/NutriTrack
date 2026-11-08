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

  it('meldet die Mindestzufuhr, wenn die Formel darunter liegt', () => {
    // Arrange: 55 kg / 160 cm / sitzend / Abnehmen 0,5 kg/W -> Formel ca. 937 kcal
    const small: UserProfile = {
      weightKg: 55, heightCm: 160, age: 30, sex: 'female',
      activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 0.5,
      updatedAt: '2026-10-13T00:00:00.000Z',
    };

    // Act / Assert
    expect(svc.isMinKcalApplied(small)).toBe(true);
    expect(svc.dailyTarget(small).kcal).toBe(1200);
    expect(svc.isMinKcalApplied(male)).toBe(false);
  });

  it('rechnet Tempo in tägliches Defizit um und deckelt bei 1 % Körpergewicht pro Woche', () => {
    // 80 kg -> Deckel 0,8 kg/Woche
    expect(svc.dailyDeltaKcal(0.5, 80)).toBe(550);
    expect(svc.dailyDeltaKcal(0.25, 80)).toBe(275);
    expect(svc.dailyDeltaKcal(2, 80)).toBe(svc.dailyDeltaKcal(0.8, 80));
    expect(svc.dailyTarget({ ...male, goal: 'lose', rateKgPerWeek: 2 }).kcal)
      .toBe(svc.dailyTarget({ ...male, goal: 'lose', rateKgPerWeek: 0.8 }).kcal);
  });

  it('begrenzt das Tempo relativ zum Gewicht: bei 60 kg auf 0,6, bei 120 kg bleibt 0,75 erlaubt', () => {
    expect(svc.maxRateKgPerWeek(60)).toBeCloseTo(0.6, 5);
    expect(svc.dailyDeltaKcal(0.75, 60)).toBe(660);
    expect(svc.maxRateKgPerWeek(120)).toBeCloseTo(1.2, 5);
    expect(svc.dailyDeltaKcal(0.75, 120)).toBe(825);
  });

  it('liefert das erreichte Tempo, wenn die Mindestzufuhr greift', () => {
    const small: UserProfile = {
      weightKg: 55, heightCm: 160, age: 30, sex: 'female',
      activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 0.5,
      updatedAt: '2026-10-13T00:00:00.000Z',
    };
    const achieved = svc.achievedRateKgPerWeek(small);
    expect(achieved).toBeLessThan(0.5);
    expect(achieved).toBeGreaterThanOrEqual(0);
    expect(svc.achievedRateKgPerWeek({ ...male, goal: 'lose', rateKgPerWeek: 0.5 })).toBeCloseTo(0.5, 2);
    expect(svc.achievedRateKgPerWeek(male)).toBe(0);
  });

  it('meldet das gedeckelte Tempo als erreichtes Tempo', () => {
    const light: UserProfile = { ...male, weightKg: 60, goal: 'lose', rateKgPerWeek: 0.75 };
    expect(svc.achievedRateKgPerWeek(light)).toBeCloseTo(0.6, 1);
  });

  describe('Eiweißziel (g/kg mit Referenzgewicht)', () => {
    it('nutzt bei BMI bis 30 das tatsächliche Gewicht', () => {
      expect(svc.proteinReferenceWeightKg(male)).toBe(80);
      expect(svc.proteinReferenceWeightKg({ ...male, weightKg: 97.2 })).toBe(97.2); // BMI genau 30
    });

    it('nutzt bei BMI über 30 das Gewicht bei BMI 25', () => {
      const heavy: UserProfile = { ...male, weightKg: 120, goal: 'lose' };
      // 25 * 1,8^2 = 81
      expect(svc.proteinReferenceWeightKg(heavy)).toBeCloseTo(81, 5);
      expect(svc.dailyTarget(heavy).proteinG).toBe(146); // 1,8 * 81
    });

    it('bevorzugt bei BMI über 30 das Zielgewicht, falls vorhanden', () => {
      const heavy: UserProfile = { ...male, weightKg: 120, targetWeightKg: 90, goal: 'lose' };
      expect(svc.proteinReferenceWeightKg(heavy)).toBe(90);
      expect(svc.dailyTarget(heavy).proteinG).toBe(162);
    });

    it('ignoriert ein unplausibles Zielgewicht', () => {
      const heavy: UserProfile = { ...male, weightKg: 120, targetWeightKg: 0 };
      expect(svc.proteinReferenceWeightKg(heavy)).toBeCloseTo(81, 5);
    });

    it('liegt nie über 2,2 g je kg Referenzgewicht', () => {
      (['lose', 'maintain', 'gain'] as const).forEach((goal) => {
        const p = { ...male, goal };
        expect(svc.dailyTarget(p).proteinG).toBeLessThanOrEqual(Math.round(2.2 * svc.proteinReferenceWeightKg(p)));
      });
    });
  });

  describe('Fett und Mindestzufuhr', () => {
    it('setzt Fett auf 30 % der kcal', () => {
      const t = svc.dailyTarget(male);
      expect(t.fatG).toBe(Math.round((t.kcal * 0.3) / 9)); // 92
    });

    it('hebt beim Halten nicht auf die Mindestzufuhr an', () => {
      const small: UserProfile = {
        weightKg: 45, heightCm: 150, age: 70, sex: 'female',
        activityLevel: 'sedentary', goal: 'maintain', updatedAt: '',
      };
      expect(svc.isMinKcalApplied(small)).toBe(false);
      expect(svc.dailyTarget(small).kcal).toBe(Math.round(svc.totalDailyEnergy(small)));
      expect(svc.dailyTarget(small).kcal).toBeLessThan(1200);
    });

    it('hebt beim Abnehmen weiter an', () => {
      const small: UserProfile = {
        weightKg: 45, heightCm: 150, age: 70, sex: 'female',
        activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 0.25, updatedAt: '',
      };
      expect(svc.isMinKcalApplied(small)).toBe(true);
      expect(svc.dailyTarget(small).kcal).toBe(1200);
    });
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
