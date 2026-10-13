import { Injectable } from '@angular/core';
import {
  ActivityLevel,
  DailyTarget,
  NutritionFacts,
  UserProfile,
} from '../models';

/** Energiegehalt pro Gramm Makronährstoff (kcal/g). */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** 1 kg Körperfett ≈ 7700 kcal. */
const KCAL_PER_KG = 7700;

/** PAL-Faktoren je Aktivitätslevel. */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** Untergrenzen für die Zufuhr, um unsichere Defizite zu vermeiden. */
const MIN_KCAL = { male: 1500, female: 1200 } as const;

/** Protein-Zielwerte in g pro kg Körpergewicht je Ziel. */
const PROTEIN_G_PER_KG = { lose: 1.8, maintain: 1.6, gain: 2.0 } as const;

/** Fettanteil an der Gesamtenergie. */
const FAT_ENERGY_RATIO = 0.27;

/** Ballaststoffe: 14 g je 1000 kcal (DGE/US-Richtwert). */
const FIBER_G_PER_1000_KCAL = 14;

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
    return p.sex === 'male' ? base + 5 : base - 161;
  }

  /** Gesamtumsatz (TDEE) = BMR × Aktivitätsfaktor. */
  totalDailyEnergy(p: UserProfile): number {
    return this.basalMetabolicRate(p) * ACTIVITY_FACTORS[p.activityLevel];
  }

  /**
   * Tagesziel inkl. Ziel-Anpassung (Defizit/Überschuss) und Makro-Split.
   * Deckelt das Ergebnis auf eine sichere Untergrenze.
   */
  dailyTarget(p: UserProfile): DailyTarget {
    const tdee = this.totalDailyEnergy(p);
    const rate = p.goal === 'maintain' ? 0 : Math.abs(p.rateKgPerWeek ?? 0.5);
    const dailyDelta = (rate * KCAL_PER_KG) / 7;

    let kcal = tdee;
    if (p.goal === 'lose') kcal = tdee - dailyDelta;
    else if (p.goal === 'gain') kcal = tdee + dailyDelta;

    kcal = Math.max(kcal, MIN_KCAL[p.sex]);
    kcal = Math.round(kcal);

    const proteinG = Math.round(PROTEIN_G_PER_KG[p.goal] * p.weightKg);
    const fatG = Math.round((kcal * FAT_ENERGY_RATIO) / KCAL_PER_G.fat);
    const proteinKcal = proteinG * KCAL_PER_G.protein;
    const fatKcal = fatG * KCAL_PER_G.fat;
    const carbsG = Math.max(
      0,
      Math.round((kcal - proteinKcal - fatKcal) / KCAL_PER_G.carbs),
    );
    const fiberG = Math.round((kcal / 1000) * FIBER_G_PER_1000_KCAL);

    return { kcal, proteinG, carbsG, fatG, fiberG };
  }

  /**
   * Skaliert Nährwerte auf eine konkrete Menge (Gramm).
   * `facts` kann pro 100 g oder pro Portion vorliegen.
   */
  scaleToGrams(facts: NutritionFacts, grams: number): NutritionFacts {
    const refGrams = facts.basis === 'per100g' ? 100 : facts.portionG ?? 100;
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
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
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
