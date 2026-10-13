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

  calculate(): void {
    const profile: UserProfile = {
      weightKg: Number(this.weightKg),
      heightCm: Number(this.heightCm),
      age: Number(this.age),
      sex: this.sex,
      activityLevel: this.activityLevel,
      goal: this.goal,
      rateKgPerWeek: this.showRate ? Number(this.rateKgPerWeek) : 0,
      updatedAt: new Date().toISOString(),
    };
    this.target = this.calc.dailyTarget(profile);
  }
}
