import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivityLevel, AiConfig, Goal, Sex, UserProfile } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { SettingsStore } from '../core/state/settings.store';
import { ShoppingStore } from '../core/state/shopping.store';

/**
 * Einstellungen: Profil erfassen → Tagesbedarf berechnen (deterministisch),
 * KI-Anbieter konfigurieren (lokal gespeichert) und Daten zurücksetzen.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly profileStore = inject(ProfileStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly diary = inject(DiaryStore);
  private readonly recipes = inject(RecipeStore);
  private readonly shopping = inject(ShoppingStore);

  readonly target = this.profileStore.target;
  readonly error = signal<string | null>(null);
  readonly savedToast = signal<string | null>(null);

  // --- Profil-Formular (mit Werten aus gespeichertem Profil, sonst Defaults) ---
  private readonly existing = this.profileStore.profile();
  weightKg: number | null = this.existing?.weightKg ?? 80;
  heightCm: number | null = this.existing?.heightCm ?? 180;
  age: number | null = this.existing?.age ?? 30;
  sex: Sex = this.existing?.sex ?? 'male';
  activityLevel: ActivityLevel = this.existing?.activityLevel ?? 'moderate';
  goal: Goal = this.existing?.goal ?? 'lose';
  rateKgPerWeek: number | null = this.existing?.rateKgPerWeek ?? 0.5;

  // --- KI-Konfiguration (Kopie zum Bearbeiten) ---
  ai: AiConfig = { ...this.settingsStore.ai() };

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

  readonly providers = [
    { value: 'mock', label: 'Mock (Test, offline)' },
    { value: 'claude', label: 'Claude (Anthropic)' },
  ];

  private readonly ranges = {
    weightKg: { min: 30, max: 300, label: 'Gewicht' },
    heightCm: { min: 100, max: 250, label: 'Größe' },
    age: { min: 14, max: 100, label: 'Alter' },
    rateKgPerWeek: { min: 0.1, max: 1.5, label: 'Tempo' },
  } as const;

  get showRate(): boolean {
    return this.goal !== 'maintain';
  }

  private validate(value: number | null, key: keyof typeof this.ranges, errs: string[]): number | null {
    const r = this.ranges[key];
    const n = typeof value === 'number' ? value : Number(value);
    if (value === null || !Number.isFinite(n)) {
      errs.push(`${r.label}: bitte eine Zahl eingeben.`);
      return null;
    }
    if (n < r.min || n > r.max) {
      errs.push(`${r.label}: muss zwischen ${r.min} und ${r.max} liegen.`);
      return null;
    }
    return n;
  }

  saveProfile(): void {
    const errs: string[] = [];
    const weightKg = this.validate(this.weightKg, 'weightKg', errs);
    const heightCm = this.validate(this.heightCm, 'heightCm', errs);
    const age = this.validate(this.age, 'age', errs);
    const rate = this.showRate ? this.validate(this.rateKgPerWeek, 'rateKgPerWeek', errs) : 0;

    if (weightKg === null || heightCm === null || age === null || rate === null) {
      this.error.set(errs[0] ?? 'Bitte Eingaben prüfen.');
      return;
    }
    this.error.set(null);

    const profile: UserProfile = {
      weightKg,
      heightCm,
      age,
      sex: this.sex,
      activityLevel: this.activityLevel,
      goal: this.goal,
      rateKgPerWeek: rate,
      updatedAt: new Date().toISOString(),
    };
    this.profileStore.setProfile(profile);
    this.savedToast.set('Profil gespeichert — Tagesbedarf aktualisiert.');
  }

  saveAi(): void {
    this.settingsStore.setAi({ ...this.ai });
    this.savedToast.set('KI-Einstellungen gespeichert.');
  }

  resetData(): void {
    this.profileStore.clear();
    this.diary.clear();
    this.recipes.clear();
    this.shopping.clear();
    this.settingsStore.clear();
    this.ai = { ...this.settingsStore.ai() };
    this.savedToast.set('Alle Daten wurden zurückgesetzt.');
  }

  onToastDismiss(): void {
    this.savedToast.set(null);
  }
}
