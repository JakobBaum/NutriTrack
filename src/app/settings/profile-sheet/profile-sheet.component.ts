import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ActivityLevel, DailyTarget, Goal, Sex, UserProfile } from '../../core/models';
import { PROTEIN_NOTE_ABOVE_G_PER_KG } from '../../core/nutrition/manual-target';
import { NutritionCalcService } from '../../core/nutrition/nutrition-calc.service';
import { ProfileNote, profileNotes } from '../../core/nutrition/profile-plausibility';
import { ProfileStore } from '../../core/state/profile.store';
import { formatDecimal, parseDecimal } from '../../core/util/number-input';
import { PROFILE_FIELD_ORDER, ProfileField, ProfileFieldErrors, targetWeightError, validateProfileForm } from '../profile-form';
import {
  ProfileFormState,
  formStateFromProfile,
  manualErrors,
  profileFromFormState,
  rateChoicesFor,
  rateForGoal,
  withManualEnabled,
} from './profile-form-state';

type FocusField = ProfileField | 'manualKcal' | 'manualProtein';

/** Bestätigung nach dem Speichern (Toast der Einstellungsseite). */
const SAVED_MESSAGE = 'Profil gespeichert — Tagesziel aktualisiert.';

/**
 * Profil-Sheet: lädt das Formular bei jedem Öffnen frisch aus dem gespeicherten Profil,
 * zeigt das Tagesziel live an und erlaubt ein manuelles Kalorien- und Eiweißziel.
 */
@Component({
  selector: 'app-profile-sheet',
  templateUrl: './profile-sheet.component.html',
  styleUrls: ['./profile-sheet.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSheetComponent {
  private readonly profileStore = inject(ProfileStore);
  private readonly calc = inject(NutritionCalcService);
  private readonly doc = inject(DOCUMENT);

  readonly isOpen = input(false);
  /** Gewicht, mit dem das Formular beim Öffnen vorbelegt wird (Hinweis „Ziel neu berechnen“). */
  readonly prefillWeightKg = input<number | null>(null);
  readonly closed = output<void>();
  /** Gespeichert; Text für die Bestätigung. */
  readonly saved = output<string>();

  readonly form = signal<ProfileFormState>(formStateFromProfile(null));
  /** Felder, die der Nutzer schon verlassen hat (Fehler erst danach zeigen). */
  readonly touched = signal<Partial<Record<FocusField, boolean>>>({});
  readonly submitted = signal(false);

  readonly sexes: { value: Sex; label: string }[] = [
    { value: 'male', label: 'Männlich' },
    { value: 'female', label: 'Weiblich' },
    { value: 'diverse', label: 'Divers' },
  ];
  readonly activities: { value: ActivityLevel; label: string }[] = [
    { value: 'sedentary', label: 'Sitzend (kaum Sport)' },
    { value: 'light', label: 'Leicht aktiv (Training 1–3×/Woche)' },
    { value: 'moderate', label: 'Mäßig aktiv (Training 3–5×/Woche)' },
    { value: 'active', label: 'Aktiv (Training 6–7×/Woche)' },
    { value: 'veryActive', label: 'Sehr aktiv (körperliche Arbeit)' },
  ];
  readonly goals: { value: Goal; label: string }[] = [
    { value: 'lose', label: 'Abnehmen' },
    { value: 'maintain', label: 'Halten' },
    { value: 'gain', label: 'Zunehmen' },
  ];

  constructor() {
    // Beim Öffnen immer frisch aus dem Store laden: keine Altwerte nach Reset, Import oder Schließen ohne Speichern.
    effect(() => {
      if (this.isOpen()) untracked(() => this.load());
    });
  }

  private load(): void {
    const base = formStateFromProfile(this.profileStore.profile());
    const prefill = this.prefillWeightKg();
    this.form.set(prefill === null ? base : { ...base, weightKg: prefill });
    this.touched.set(prefill === null ? {} : { weightKg: true });
    this.submitted.set(false);
  }

  // --- abgeleitete Werte ---
  readonly showRate = computed(() => this.form().goal !== 'maintain');
  readonly rateChoices = computed(() => rateChoicesFor(this.form().goal));
  readonly goalForRate = computed<Goal>(() => (this.form().goal === 'gain' ? 'gain' : 'lose'));

  readonly fieldErrors = computed<ProfileFieldErrors>(() => {
    const f = this.form();
    return validateProfileForm(
      { weightKg: f.weightKg, heightCm: f.heightCm, age: f.age, rateKgPerWeek: f.rateKgPerWeek },
      this.showRate(),
    );
  });
  readonly targetError = computed(() => {
    const f = this.form();
    return targetWeightError(f.targetWeightKg, f.weightKg, f.goal, f.heightCm);
  });
  readonly manualFieldErrors = computed(() => manualErrors(this.form()));
  readonly isValid = computed(
    () => Object.keys(this.fieldErrors()).length === 0 && this.targetError() === null
      && Object.keys(this.manualFieldErrors()).length === 0,
  );

  /** Profil aus dem Formular (nur wenn Gewicht, Größe und Alter gültig sind), inklusive gültiger manueller Werte. */
  private readonly draft = computed<UserProfile | null>(() => {
    const errors = this.fieldErrors();
    if (errors.weightKg || errors.heightCm || errors.age) return null;
    return profileFromFormState(this.form(), '');
  });
  /** Profil aus dem Formular ohne manuelle Ziele (Formelwerte als Referenz). */
  private readonly formulaDraft = computed<UserProfile | null>(() => {
    const errors = this.fieldErrors();
    if (errors.weightKg || errors.heightCm || errors.age) return null;
    return profileFromFormState({ ...this.form(), manual: false }, '');
  });

  /** Live-Vorschau des Tagesziels (null, solange Gewicht, Größe oder Alter fehlen). */
  readonly preview = computed<DailyTarget | null>(() => {
    const d = this.draft();
    return d ? this.calc.dailyTarget(d) : null;
  });
  readonly formula = computed<DailyTarget | null>(() => {
    const d = this.formulaDraft();
    return d ? this.calc.dailyTarget(d) : null;
  });
  /** True, wenn die Vorschau auf manuellen Werten beruht. */
  readonly previewIsManual = computed(() => {
    const d = this.draft();
    return d !== null && (d.manualKcal !== undefined || d.manualProteinGPerKg !== undefined);
  });

  readonly notes = computed<ProfileNote[]>(() => {
    const f = this.form();
    if (f.weightKg === null || f.heightCm === null || f.age === null) return [];
    return profileNotes({ weightKg: f.weightKg, heightCm: f.heightCm, age: f.age, goal: f.goal });
  });

  readonly rateDeltaText = computed(() => {
    const f = this.form();
    const kcal = this.calc.dailyDeltaKcal(f.rateKgPerWeek, f.weightKg ?? 0, this.goalForRate());
    return `≈ ${f.goal === 'lose' ? '−' : '+'}${kcal} kcal/Tag`;
  });
  readonly maxRateText = computed(() => {
    const max = this.calc.maxRateKgPerWeek(this.form().weightKg ?? 0, this.goalForRate());
    return max > 0 ? formatDecimal(Math.round(max * 100) / 100) : '';
  });
  readonly rateIsCapped = computed(() => {
    const max = this.calc.maxRateKgPerWeek(this.form().weightKg ?? 0, this.goalForRate());
    return max > 0 && this.form().rateKgPerWeek > max + 1e-9;
  });

  private readonly achievedRate = computed(() => {
    const d = this.formulaDraft();
    return d ? this.calc.achievedRateKgPerWeek(d) : 0;
  });
  readonly minKcalApplied = computed(() => {
    const d = this.draft();
    return d !== null && this.calc.isMinKcalApplied(d);
  });
  readonly achievedRateText = computed(() => formatDecimal(Math.round(this.achievedRate() * 10) / 10) || '0');
  readonly lowerRateOffer = computed<number | null>(() => {
    const offer = Math.floor(this.achievedRate() / 0.05) * 0.05;
    return offer >= 0.1 ? Math.round(offer * 100) / 100 : null;
  });

  /** Hinweis, wenn das manuelle Kalorienziel unter der Mindestzufuhr liegt (Warnung, keine Sperre). */
  readonly manualKcalWarning = computed(() => {
    const f = this.form();
    const kcal = f.manual ? parseDecimal(f.manualKcalText) : null;
    if (kcal === null || kcal < 1000) return null;
    const min = this.calc.minimumKcal({ sex: f.sex });
    return kcal < min ? `Unter der üblichen Mindestzufuhr von ${min.toLocaleString('de-DE')} kcal. Das ist nur ein Hinweis.` : null;
  });
  /** Gramm Eiweiß pro Tag, die das g/kg-Ziel ergibt (null bei ungültiger Eingabe oder ohne Gewicht). */
  readonly manualProteinGrams = computed(() => {
    const f = this.form();
    const perKg = parseDecimal(f.manualProteinText);
    return f.weightKg !== null && perKg !== null && !this.manualFieldErrors().protein ? Math.round(perKg * f.weightKg) : null;
  });
  readonly manualProteinNote = computed(() => {
    const perKg = parseDecimal(this.form().manualProteinText);
    return perKg !== null && perKg > PROTEIN_NOTE_ABOVE_G_PER_KG && !this.manualFieldErrors().protein
      ? 'Über 2,2 g/kg bringt für die meisten keinen zusätzlichen Vorteil.'
      : null;
  });

  // --- Fehlertexte, die erst nach dem Verlassen des Felds oder beim Speichern erscheinen ---
  visibleError(field: ProfileField): string | null {
    return this.touched()[field] || this.submitted() ? (this.fieldErrors()[field] ?? null) : null;
  }
  visibleManualError(field: 'kcal' | 'protein'): string | null {
    const key: FocusField = field === 'kcal' ? 'manualKcal' : 'manualProtein';
    const text = field === 'kcal' ? this.form().manualKcalText : this.form().manualProteinText;
    return this.touched()[key] || this.submitted() || text !== '' ? (this.manualFieldErrors()[field] ?? null) : null;
  }

  private touch(field: FocusField): void {
    this.touched.update((t) => ({ ...t, [field]: true }));
  }

  // --- Eingaben (immer neuer Zustand) ---
  setField(field: 'weightKg' | 'heightCm' | 'age', value: number): void {
    this.form.update((f) => ({ ...f, [field]: value }));
    this.touch(field);
  }
  setSex(sex: Sex): void {
    this.form.update((f) => ({ ...f, sex }));
  }
  setActivity(activityLevel: ActivityLevel): void {
    this.form.update((f) => ({ ...f, activityLevel }));
  }
  setGoal(goal: Goal): void {
    if (goal === this.form().goal) return;
    this.form.update((f) => ({ ...f, goal, rateKgPerWeek: rateForGoal(goal, f.rateKgPerWeek) }));
  }
  setRate(rate: number): void {
    this.form.update((f) => ({ ...f, rateKgPerWeek: rate }));
  }
  setTargetWeight(value: number): void {
    this.form.update((f) => ({ ...f, targetWeightKg: value }));
  }
  clearTargetWeight(): void {
    this.form.update((f) => ({ ...f, targetWeightKg: null }));
  }
  setManualMode(manual: boolean): void {
    if (manual === this.form().manual) return;
    this.form.update((f) => (manual ? withManualEnabled(f, this.formula()) : { ...f, manual: false }));
  }
  /** Zurück zur Formel: Eingaben verwerfen, damit sie beim nächsten Wechsel neu vorbelegt werden. */
  resetToFormula(): void {
    this.form.update((f) => ({ ...f, manual: false, manualKcalText: '', manualProteinText: '' }));
    this.touched.update((t) => ({ ...t, manualKcal: false, manualProtein: false }));
  }
  setManualKcal(text: string): void {
    this.form.update((f) => ({ ...f, manualKcalText: text }));
  }
  setManualProtein(text: string): void {
    this.form.update((f) => ({ ...f, manualProteinText: text }));
  }
  markTouched(field: FocusField): void {
    this.touch(field);
  }

  // --- Speichern ---
  private focusFirstInvalid(): void {
    const errors = this.fieldErrors();
    const first: FocusField | undefined = PROFILE_FIELD_ORDER.find((f) => errors[f])
      ?? (this.manualFieldErrors().kcal ? 'manualKcal' : this.manualFieldErrors().protein ? 'manualProtein' : undefined);
    if (!first) return;
    const el = this.doc.querySelector<HTMLElement>(`[data-field="${first}"]`);
    if (!el) return;
    if ('setFocus' in el) void (el as unknown as { setFocus: () => Promise<void> }).setFocus();
    else el.querySelector<HTMLElement>('button')?.focus();
  }

  save(): void {
    this.submitted.set(true);
    const profile = profileFromFormState(this.form(), new Date().toISOString());
    if (!this.isValid() || profile === null) {
      this.focusFirstInvalid();
      return;
    }
    this.profileStore.setProfile(profile);
    this.saved.emit(SAVED_MESSAGE);
    this.closed.emit();
  }
}
