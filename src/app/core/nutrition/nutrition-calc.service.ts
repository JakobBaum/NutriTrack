import { Injectable } from '@angular/core';
import {
  ActivityLevel,
  DailyTarget,
  Goal,
  NutritionFacts,
  UserProfile,
} from '../models';
import { manualKcalOf, manualProteinPerKgOf } from './manual-target';

/** Energiegehalt pro Gramm Makronährstoff (kcal/g). */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** 1 kg Körpergewicht ≈ 7700 kcal (Fettgewebe). */
const KCAL_PER_KG = 7700;

/** Größtes empfohlenes Abnehm-Tempo: Anteil des Körpergewichts pro Woche (1 %); darüber wird gedeckelt. */
export const MAX_RATE_FRACTION_PER_WEEK = 0.01;

/** Größtes empfohlenes Aufbau-Tempo (0,5 % pro Woche): ein größerer Überschuss wird überwiegend Fett. */
export const MAX_GAIN_FRACTION_PER_WEEK = 0.005;

/** Vorgabe-Tempo in kg pro Woche, wenn keines gespeichert ist. */
export const DEFAULT_RATE_KG_PER_WEEK = { lose: 0.5, gain: 0.25 } as const;

/** PAL-Faktoren je Aktivitätslevel. */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** Untergrenzen für die Zufuhr beim Abnehmen, um unsichere Defizite zu vermeiden. */
const MIN_KCAL: Record<string, number> = { male: 1500, female: 1200, diverse: 1350 };

/** Protein-Zielwerte in g pro kg Referenzgewicht je Ziel. */
const PROTEIN_G_PER_KG = { lose: 1.8, maintain: 1.6, gain: 2.0 } as const;

/** Obergrenze für das Eiweißziel in g pro kg Referenzgewicht. */
const MAX_PROTEIN_G_PER_KG = 2.2;

/** Ab diesem BMI wird das Eiweißziel nicht mehr aus dem Ist-Gewicht gerechnet. */
const REFERENCE_WEIGHT_BMI_THRESHOLD = 30;

/** BMI, bei dem das Referenzgewicht liegt, wenn kein Zielgewicht vorhanden ist. */
const REFERENCE_BMI = 25;

/** Fettanteil an der Gesamtenergie (DGE-Richtwert 30 bis 40 %, untere Grenze). */
const FAT_ENERGY_RATIO = 0.3;

/** Ballaststoffe: 14 g je 1000 kcal (DGE/US-Richtwert). */
const FIBER_G_PER_1000_KCAL = 14;

/** Freier Zucker (Obergrenze): WHO-Empfehlung < 10 % der Energie, 4 kcal/g. */
const SUGAR_ENERGY_RATIO = 0.1;

/** Standard-Bezugsmenge (g), wenn keine gültige Portionsgröße vorliegt. */
const DEFAULT_PORTION_G = 100;

/** Portionsgröße nur, wenn endlich und > 0 – sonst Standard (verhindert Division durch 0). */
function validPortionG(portionG: number | undefined): number {
  return portionG !== undefined && Number.isFinite(portionG) && portionG > 0
    ? portionG
    : DEFAULT_PORTION_G;
}

/**
 * Reine, testbare Ernährungs-Rechenlogik. Dient als deterministischer Fallback,
 * wenn kein KI-Anbieter für die Bedarfsberechnung verfügbar ist, und als
 * Basis zur Mengenskalierung von Nährwerten.
 */
@Injectable({ providedIn: 'root' })
export class NutritionCalcService {
  /** Grundumsatz nach Mifflin-St Jeor (kcal/Tag). */
  basalMetabolicRate(p: UserProfile): number {
    const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
    if (p.sex === 'male') return base + 5;
    if (p.sex === 'female') return base - 161;
    // diverse: Mittelwert männlich/weiblich (−78 entspricht Durchschnitt von +5 und −161)
    return base - 78;
  }

  /** Gesamtumsatz (TDEE) = BMR × Aktivitätsfaktor. */
  totalDailyEnergy(p: UserProfile): number {
    return this.basalMetabolicRate(p) * ACTIVITY_FACTORS[p.activityLevel];
  }

  /** Größtes Tempo (kg/Woche) für ein Körpergewicht: 1 % beim Abnehmen, 0,5 % beim Zunehmen. */
  maxRateKgPerWeek(weightKg: number, goal: Goal = 'lose'): number {
    const fraction = goal === 'gain' ? MAX_GAIN_FRACTION_PER_WEEK : MAX_RATE_FRACTION_PER_WEEK;
    return Number.isFinite(weightKg) && weightKg > 0 ? weightKg * fraction : 0;
  }

  /**
   * Gewicht, auf das sich das Eiweißziel bezieht: das tatsächliche Gewicht, bei BMI über 30
   * das Zielgewicht (falls plausibel) oder das Gewicht bei BMI 25.
   */
  proteinReferenceWeightKg(p: UserProfile): number {
    const weightKg = Number.isFinite(p.weightKg) && p.weightKg > 0 ? p.weightKg : 0;
    const heightM = p.heightCm / 100;
    if (weightKg === 0 || !Number.isFinite(heightM) || heightM <= 0) return weightKg;
    if (weightKg / (heightM * heightM) <= REFERENCE_WEIGHT_BMI_THRESHOLD) return weightKg;
    const target = p.targetWeightKg;
    if (target !== undefined && Number.isFinite(target) && target > 0 && target < weightKg) return target;
    return REFERENCE_BMI * heightM * heightM;
  }

  /**
   * Tagesziel inkl. Ziel-Anpassung (Defizit/Überschuss) und Makro-Split.
   * Beim Abnehmen wird das Ergebnis auf eine sichere Untergrenze angehoben.
   */
  dailyTarget(p: UserProfile): DailyTarget {
    const kcal = manualKcalOf(p) ?? Math.round(this.applyMinKcal(p, this.uncappedKcal(p)));

    const manualPerKg = manualProteinPerKgOf(p);
    const perKg = Math.min(PROTEIN_G_PER_KG[p.goal], MAX_PROTEIN_G_PER_KG);
    const proteinG = manualPerKg !== null
      ? Math.round(manualPerKg * p.weightKg)
      : Math.round(perKg * this.proteinReferenceWeightKg(p));
    const fatG = Math.round((kcal * FAT_ENERGY_RATIO) / KCAL_PER_G.fat);
    const proteinKcal = proteinG * KCAL_PER_G.protein;
    const fatKcal = fatG * KCAL_PER_G.fat;
    const carbsG = Math.max(
      0,
      Math.round((kcal - proteinKcal - fatKcal) / KCAL_PER_G.carbs),
    );
    const fiberG = Math.round((kcal / 1000) * FIBER_G_PER_1000_KCAL);
    const sugarG = Math.round((kcal * SUGAR_ENERGY_RATIO) / KCAL_PER_G.carbs);

    return { kcal, proteinG, carbsG, fatG, fiberG, sugarG };
  }

  /** `true`, wenn die Mindestzufuhr das rechnerische Ziel anhebt (nur beim Abnehmen, Formel liegt darunter). */
  isMinKcalApplied(p: UserProfile): boolean {
    if (manualKcalOf(p) !== null) return false;
    const uncapped = this.uncappedKcal(p);
    if (!Number.isFinite(uncapped)) return true;
    return p.goal === 'lose' && uncapped < this.minKcal(p);
  }

  /** Tägliches Defizit/Überschuss (kcal) für ein Tempo in kg/Woche (je Ziel auf 1 % bzw. 0,5 % des Körpergewichts begrenzt). */
  dailyDeltaKcal(rateKgPerWeek: number, weightKg: number, goal: Goal = 'lose'): number {
    const rate = Math.min(Math.abs(rateKgPerWeek), this.maxRateKgPerWeek(weightKg, goal));
    return Math.round((rate * KCAL_PER_KG) / 7);
  }

  /**
   * Tatsächlich erreichtes Tempo (kg/Woche) nach Mindestzufuhr: kleiner als der
   * Wunsch, wenn die Untergrenze das Defizit begrenzt. Bei „halten“ 0.
   */
  achievedRateKgPerWeek(p: UserProfile): number {
    if (p.goal === 'maintain') return 0;
    const wished = Math.min(Math.abs(p.rateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK[p.goal]), this.maxRateKgPerWeek(p.weightKg, p.goal));
    const actualDelta = Math.abs(this.totalDailyEnergy(p) - this.dailyTarget(p).kcal);
    return Math.min(wished, (actualDelta * 7) / KCAL_PER_KG);
  }

  /** Rechnerisches Kalorienziel vor der Mindestzufuhr. */
  private uncappedKcal(p: UserProfile): number {
    const tdee = this.totalDailyEnergy(p);
    const rate = p.goal === 'maintain' ? 0 : Math.abs(p.rateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK[p.goal]);
    const dailyDelta = this.dailyDeltaKcal(rate, p.weightKg, p.goal);
    if (p.goal === 'lose') return tdee - dailyDelta;
    if (p.goal === 'gain') return tdee + dailyDelta;
    return tdee;
  }

  /** Hebt das Ziel beim Abnehmen auf die Mindestzufuhr an; ohne gültigen Wert gilt die Mindestzufuhr. */
  private applyMinKcal(p: UserProfile, kcal: number): number {
    if (!Number.isFinite(kcal)) return this.minKcal(p);
    return p.goal === 'lose' ? Math.max(kcal, this.minKcal(p)) : kcal;
  }

  private minKcal(p: UserProfile): number {
    return this.minimumKcal(p);
  }

  /** Mindestzufuhr (kcal) für das Geschlecht; dient auch für Warnhinweise bei manuellen Zielen. */
  minimumKcal(p: Pick<UserProfile, 'sex'>): number {
    return MIN_KCAL[p.sex] ?? 1350;
  }

  /**
   * Skaliert Nährwerte auf eine konkrete Menge (Gramm).
   * `facts` kann pro 100 g oder pro Portion vorliegen.
   */
  scaleToGrams(facts: NutritionFacts, grams: number): NutritionFacts {
    const refGrams = facts.basis === 'per100g' ? 100 : validPortionG(facts.portionG);
    const f = grams / refGrams;
    return this.scaleBy(facts, f, grams);
  }

  /** Skaliert Nährwerte auf eine Anzahl Portionen. */
  scaleToPortions(facts: NutritionFacts, portions: number): NutritionFacts {
    const grams = (facts.portionG ?? 0) * portions || undefined;
    return this.scaleBy(facts, portions, grams);
  }

  /** Summiert mehrere Nährwert-Sätze zu einem Gesamtwert. */
  sum(items: NutritionFacts[]): DailyTarget {
    return items.reduce(
      (acc, f) => ({
        kcal: acc.kcal + (f.kcal || 0),
        proteinG: acc.proteinG + (f.proteinG || 0),
        carbsG: acc.carbsG + (f.carbsG || 0),
        fatG: acc.fatG + (f.fatG || 0),
        fiberG: acc.fiberG + (f.fiberG || 0),
        sugarG: acc.sugarG + (f.sugarG || 0),
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 },
    );
  }

  private scaleBy(
    facts: NutritionFacts,
    factor: number,
    portionG?: number,
  ): NutritionFacts {
    const r = (v: number | undefined) =>
      v == null ? undefined : Math.round(v * factor * 10) / 10;
    return {
      kcal: Math.round((facts.kcal || 0) * factor),
      proteinG: r(facts.proteinG) ?? 0,
      carbsG: r(facts.carbsG) ?? 0,
      fatG: r(facts.fatG) ?? 0,
      fiberG: r(facts.fiberG),
      sugarG: r(facts.sugarG),
      saltG: r(facts.saltG),
      basis: 'perPortion',
      portionG,
    };
  }
}
