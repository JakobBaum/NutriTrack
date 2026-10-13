import { Component, inject } from '@angular/core';
import {
  ActivityLevel,
  DailyTarget,
  Goal,
  Sex,
  UserProfile,
} from '../core/models';
import { NutritionCalcService } from '../core/nutrition/nutrition-calc.service';

/**
 * Vorläufige Startseite: Kalorien-/Makro-Bedarfsrechner.
 * Nutzt den getesteten NutritionCalcService (Mifflin-St Jeor) als deterministische
 * Basis. Wird in Phase 1 durch die Tab-Shell + das echte Dashboard ersetzt.
 */
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  private readonly calc = inject(NutritionCalcService);

  weightKg = 80;
  heightCm = 180;
  age = 30;
  sex: Sex = 'male';
  activityLevel: ActivityLevel = 'moderate';
  goal: Goal = 'lose';
  rateKgPerWeek = 0.5;

  target: DailyTarget | null = null;
  errors: string[] = [];

  /** Erlaubte Wertebereiche je Feld (Untergrenze/Obergrenze). */
  private readonly ranges = {
    weightKg: { min: 30, max: 300, label: 'Gewicht' },
    heightCm: { min: 100, max: 250, label: 'Größe' },
    age: { min: 14, max: 100, label: 'Alter' },
    rateKgPerWeek: { min: 0.1, max: 1.5, label: 'Tempo' },
  };

  readonly sexes: { value: Sex; label: string }[] = [
    { value: 'male', label: 'Männlich' },
    { value: 'female', label: 'Weiblich' },
  ];

  readonly activities: { value: ActivityLevel; label: string }[] = [
    { value: 'sedentary', label: 'Sitzend (wenig Bewegung)' },
    { value: 'light', label: 'Leicht aktiv (1–3×/Woche)' },
    { value: 'moderate', label: 'Mäßig aktiv (3–5×/Woche)' },
    { value: 'active', label: 'Aktiv (6–7×/Woche)' },
    { value: 'veryActive', label: 'Sehr aktiv (körperl. Arbeit)' },
  ];

  readonly goals: { value: Goal; label: string }[] = [
    { value: 'lose', label: 'Abnehmen' },
    { value: 'maintain', label: 'Halten' },
    { value: 'gain', label: 'Zunehmen' },
  ];

  get showRate(): boolean {
    return this.goal !== 'maintain';
  }

  /** Prüft ein Feld auf gültige Zahl im erlaubten Bereich. */
  private validateField(
    value: unknown,
    key: keyof typeof this.ranges,
  ): number | null {
    const r = this.ranges[key];
    const n = typeof value === 'number' ? value : Number(value);
    if (value === null || value === undefined || (value as string) === '' || !Number.isFinite(n)) {
      this.errors.push(`${r.label}: bitte eine Zahl eingeben.`);
      return null;
    }
    if (n < r.min || n > r.max) {
      this.errors.push(`${r.label}: muss zwischen ${r.min} und ${r.max} liegen.`);
      return null;
    }
    return n;
  }

  calculate(): void {
    this.errors = [];
    this.target = null;

    const weightKg = this.validateField(this.weightKg, 'weightKg');
    const heightCm = this.validateField(this.heightCm, 'heightCm');
    const age = this.validateField(this.age, 'age');
    const rateKgPerWeek = this.showRate
      ? this.validateField(this.rateKgPerWeek, 'rateKgPerWeek')
      : 0;

    if (
      weightKg === null ||
      heightCm === null ||
      age === null ||
      rateKgPerWeek === null
    ) {
      return;
    }

    const profile: UserProfile = {
      weightKg,
      heightCm,
      age,
      sex: this.sex,
      activityLevel: this.activityLevel,
      goal: this.goal,
      rateKgPerWeek,
      updatedAt: new Date().toISOString(),
    };
    this.target = this.calc.dailyTarget(profile);
  }
}
