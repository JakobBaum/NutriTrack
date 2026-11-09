import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { ActivityLevel, Goal, Sex, UserProfile } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { MealsStore } from '../core/state/meals.store';
import { formatDecimal } from '../core/util/number-input';
import { StorageService } from '../core/storage/storage.service';
import { NutritionCalcService } from '../core/nutrition/nutrition-calc.service';
import { ProfileNote, profileNotes } from '../core/nutrition/profile-plausibility';
import { defaultAiProxyUrl } from '../core/ai/ai-endpoint';
import { AiService } from '../core/ai/ai.service';
import { CustomFoodStore } from '../core/state/custom-food.store';
import { SettingsStore } from '../core/state/settings.store';
import { AppSettingsStore } from '../core/state/app-settings.store';
import { UnitSystem } from '../core/shopping/units/unit-format';
import { WeekPlanStore } from '../core/state/week-plan.store';
import { ShoppingStore } from '../core/state/shopping.store';
import { WeightStore } from '../core/state/weight.store';
import { FavoriteStore } from '../core/state/favorite.store';
import { DebugLogService } from '../core/debug/debug-log.service';
import { resolveDebugMode, safeLocalStorage } from './debug-flag';
import { BackupService } from '../core/backup/backup.service';
import { PROFILE_FIELD_ORDER, ProfileField, ProfileFieldErrors, targetWeightError, validateProfileForm } from './profile-form';
import { BackupFile, countBackup, describeCounts, formatBackupDate } from '../core/backup/backup';

/**
 * Einstellungen: Profil erfassen → Tagesbedarf berechnen (deterministisch),
 * KI-Anbieter konfigurieren (lokal gespeichert) und Daten zurücksetzen.
 */
/** Wählbare Tempi (kg/Woche). Die Berechnung deckelt zusätzlich bei 1 % des Körpergewichts pro Woche. */
const MAX_RATE_CHOICE = 0.75;
const RATE_CHOICES: readonly number[] = [0.25, 0.5, MAX_RATE_CHOICE];
const DEFAULT_RATE = 0.5;
/** Kleinste Schrittweite beim Angebot „niedrigeres Tempo“. */
const RATE_OFFER_STEP = 0.05;
const MIN_RATE = 0.1;

function nearestRate(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return DEFAULT_RATE;
  return RATE_CHOICES.reduce((best, r) => (Math.abs(r - value) < Math.abs(best - value) ? r : best), DEFAULT_RATE);
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly profileStore = inject(ProfileStore);
  private readonly route = inject(ActivatedRoute);
  private readonly settingsStore = inject(SettingsStore);
  private readonly appSettings = inject(AppSettingsStore);
  readonly unitSystem = this.appSettings.unitSystem;

  setUnitSystem(value: UnitSystem): void {
    this.appSettings.setUnitSystem(value);
  }
  private readonly diary = inject(DiaryStore);
  private readonly recipes = inject(RecipeStore);
  private readonly customFoods = inject(CustomFoodStore);
  private readonly shopping = inject(ShoppingStore);
  private readonly weekPlan = inject(WeekPlanStore);
  private readonly savedMeals = inject(MealsStore);
  private readonly weightStore = inject(WeightStore);
  private readonly favoriteStore = inject(FavoriteStore);
  private readonly storage = inject(StorageService);
  readonly formatDecimal = formatDecimal;
  private readonly calc = inject(NutritionCalcService);
  private readonly alertCtrl = inject(AlertController);
  private readonly win = inject(DOCUMENT).defaultView;

  /** Entwickler-Werkzeuge nur mit `?debug=1` (Flag bleibt in localStorage erhalten). */
  readonly debugMode = resolveDebugMode(this.win?.location.search ?? '', safeLocalStorage(this.win));

  readonly target = this.profileStore.target;
  /** Ziel des gespeicherten Profils als Lesetext (z. B. „Abnehmen“), sonst null. */
  readonly profileGoalLabel = computed(() => {
    const goal = this.profileStore.profile()?.goal;
    return this.goals.find((g) => g.value === goal)?.label ?? null;
  });
  readonly savedToast = signal<string | null>(null);

  readonly profileOpen = signal(false);
  readonly aiOpen = signal(false);
  readonly logOpen = signal(false);
  readonly infoSection = signal<'anleitung' | 'datenschutz' | 'agb' | 'hilfe' | null>(null);

  private readonly backup = inject(BackupService);
  readonly backupBusy = signal(false);
  readonly lastBackupLabel = computed(() => {
    const label = formatBackupDate(this.backup.lastBackup());
    return label ? `Letztes Backup: ${label}` : 'Noch kein Backup erstellt';
  });

  readonly debugLog = inject(DebugLogService);
  readonly logEntries = this.debugLog.entries;

  // --- Profil-Formular (mit Werten aus gespeichertem Profil, sonst Defaults) ---
  private readonly existing = this.profileStore.profile();
  // Körperwerte starten leer (Platzhalter sind nur Beispiele), damit nichts Vorbelegtes als echte Eingabe gespeichert wird.
  weightKg: number | null = this.existing?.weightKg ?? null;
  heightCm: number | null = this.existing?.heightCm ?? null;
  age: number | null = this.existing?.age ?? null;
  sex: Sex = this.existing?.sex ?? 'male';
  activityLevel: ActivityLevel = this.existing?.activityLevel ?? 'moderate';
  goal: Goal = this.existing?.goal ?? 'maintain';
  /** Optionales Zielgewicht; null = nicht gesetzt. */
  targetWeightKg: number | null = this.existing?.targetWeightKg ?? null;
  rateKgPerWeek: number | null = this.existing?.goal && this.existing.goal !== 'maintain'
    ? (this.existing.rateKgPerWeek !== undefined && this.existing.rateKgPerWeek <= MAX_RATE_CHOICE && this.existing.rateKgPerWeek >= MIN_RATE
        ? this.existing.rateKgPerWeek
        : nearestRate(this.existing.rateKgPerWeek))
    : DEFAULT_RATE;
  readonly rateChoices = RATE_CHOICES;

  private readonly aiService = inject(AiService);
  /** Erreichbarkeit des globalen KI-Dienstes (read-only Status). */
  readonly aiTest = signal<{ busy: boolean; ok: boolean | null; message: string | null }>({
    busy: false, ok: null, message: null,
  });

  readonly sexes: { value: Sex; label: string }[] = [
    { value: 'male', label: 'Männlich' },
    { value: 'female', label: 'Weiblich' },
    { value: 'diverse', label: 'Divers' },
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


  /** Felder, die der Nutzer schon verlassen hat (Fehler erst danach zeigen). */
  touched: Partial<Record<ProfileField, boolean>> = {};

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('setup') === '1') {
      this.profileOpen.set(true);
    }
  }

  /** Aktuelles Profil nutzt die Mindestzufuhr statt der Formel. */
  get savedMinKcalApplied(): boolean {
    const p = this.profileStore.profile();
    return p !== null && this.calc.isMinKcalApplied(p);
  }

  /** Profil aus dem Formular, sofern Gewicht, Größe und Alter gesetzt sind. */
  private formProfile(): UserProfile | null {
    const w = Number(this.weightKg), h = Number(this.heightCm), a = Number(this.age);
    if (this.weightKg === null || this.heightCm === null || this.age === null) return null;
    if (![w, h, a].every((n) => Number.isFinite(n) && n > 0)) return null;
    const rate = this.showRate ? Number(this.rateKgPerWeek) : 0;
    return {
      weightKg: w, heightCm: h, age: a, sex: this.sex, activityLevel: this.activityLevel,
      goal: this.goal, rateKgPerWeek: Number.isFinite(rate) ? rate : 0, updatedAt: '',
    };
  }

  /** Formular (falls vollständig) ergibt ein Ziel unter der Mindestzufuhr. */
  get formMinKcalApplied(): boolean {
    const p = this.formProfile();
    return p !== null && this.calc.isMinKcalApplied(p);
  }

  /** Tägliches Defizit/Überschuss zum gewählten Tempo, z. B. „≈ −550 kcal/Tag“. */
  get rateDeltaLabel(): string {
    const kcal = this.calc.dailyDeltaKcal(Number(this.rateKgPerWeek) || 0, Number(this.weightKg) || 0);
    return `≈ ${this.goal === 'lose' ? '−' : '+'}${kcal} kcal/Tag`;
  }

  /** Größtes Tempo für das eingegebene Gewicht (1 % pro Woche), z. B. „0,8“; leer ohne Gewicht. */
  get maxRateText(): string {
    const max = this.calc.maxRateKgPerWeek(Number(this.weightKg) || 0);
    return max > 0 ? formatDecimal(Math.round(max * 100) / 100) : '';
  }

  /** True, wenn das gewählte Tempo über 1 % des Körpergewichts liegt und gedeckelt wird. */
  get rateIsCapped(): boolean {
    const max = this.calc.maxRateKgPerWeek(Number(this.weightKg) || 0);
    return max > 0 && (Number(this.rateKgPerWeek) || 0) > max;
  }

  /** Hinweise zu Alter und BMI der Formulareingabe (leer, solange Werte fehlen oder unauffällig sind). */
  get plausibilityNotes(): ProfileNote[] {
    if (this.weightKg === null || this.heightCm === null || this.age === null) return [];
    return profileNotes({ weightKg: this.weightKg, heightCm: this.heightCm, age: this.age, goal: this.goal });
  }

  /** Erreichtes Tempo bei aktiver Mindestzufuhr, z. B. „0,3“ (kg/Woche). */
  get achievedRateText(): string {
    const p = this.formProfile();
    return p ? formatDecimal(Math.round(this.calc.achievedRateKgPerWeek(p) * 10) / 10) || '0' : '';
  }

  /** Niedrigeres Tempo, das ohne Mindestzufuhr funktioniert (null = keines möglich). */
  get lowerRateOffer(): number | null {
    const p = this.formProfile();
    if (!p) return null;
    const achieved = this.calc.achievedRateKgPerWeek(p);
    const offer = Math.floor(achieved / RATE_OFFER_STEP) * RATE_OFFER_STEP;
    return offer >= MIN_RATE ? Math.round(offer * 100) / 100 : null;
  }

  /** Aus der Anleitung direkt zur KI-Verbindung wechseln. */
  openAiFromGuide(): void {
    this.infoSection.set(null);
    this.openAi();
  }

  /** Öffnet den KI-Status und prüft die Erreichbarkeit des globalen Dienstes. */
  openAi(): void {
    this.aiOpen.set(true);
    void this.testAi();
  }

  setRate(rate: number): void {
    this.rateKgPerWeek = rate;
  }

  setGoal(goal: Goal): void {
    this.goal = goal;
  }
  get showRate(): boolean {
    return this.goal !== 'maintain';
  }

  /** Alle aktuellen Feldfehler (leer = Formular gültig). */
  get fieldErrors(): ProfileFieldErrors {
    return validateProfileForm(
      { weightKg: this.weightKg, heightCm: this.heightCm, age: this.age, rateKgPerWeek: this.rateKgPerWeek },
      this.showRate,
    );
  }

  get isFormValid(): boolean {
    return Object.keys(this.fieldErrors).length === 0 && this.targetError === null;
  }

  /** Fehler des optionalen Zielgewichts (null = in Ordnung oder leer). */
  get targetError(): string | null {
    return targetWeightError(this.targetWeightKg, this.weightKg, this.goal, this.heightCm);
  }

  setTargetWeight(value: number): void {
    this.targetWeightKg = value;
  }

  clearTargetWeight(): void {
    this.targetWeightKg = null;
  }

  /** Hinweis "Ziel neu berechnen": Profil mit dem zuletzt gewogenen Gewicht öffnen (nichts wird automatisch gespeichert). */
  recalculateWithWeight(kg: number): void {
    this.weightKg = kg;
    this.markTouched('weightKg');
    this.profileOpen.set(true);
  }

  /** Fehlertext nur für Felder, die schon besucht wurden. */
  visibleError(field: ProfileField): string | null {
    return this.touched[field] ? (this.fieldErrors[field] ?? null) : null;
  }

  markTouched(field: ProfileField): void {
    this.touched = { ...this.touched, [field]: true };
  }

  /** Stepper-Wert übernehmen. */
  setField(field: 'weightKg' | 'heightCm' | 'age', value: number): void {
    this[field] = value;
    this.markTouched(field);
  }

  /** Fokussiert das erste fehlerhafte Feld (Reihenfolge wie im Formular). */
  private focusFirstInvalid(errors: ProfileFieldErrors): void {
    const first = PROFILE_FIELD_ORDER.find((f) => errors[f]);
    if (!first) return;
    this.win?.document.querySelector<HTMLElement>(`[data-field="${first}"] button`)?.focus();
  }

  saveProfile(): void {
    const errors = this.fieldErrors;
    const { weightKg, heightCm, age, rateKgPerWeek } = this;
    if (Object.keys(errors).length > 0 || this.targetError !== null || weightKg === null || heightCm === null || age === null) {
      this.touched = { weightKg: true, heightCm: true, age: true, rateKgPerWeek: true };
      this.focusFirstInvalid(errors);
      return;
    }
    const rate = this.showRate ? (rateKgPerWeek ?? 0) : 0;

    const profile: UserProfile = {
      weightKg,
      heightCm,
      age,
      sex: this.sex,
      activityLevel: this.activityLevel,
      goal: this.goal,
      rateKgPerWeek: rate,
      ...(this.targetWeightKg !== null ? { targetWeightKg: this.targetWeightKg } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.profileStore.setProfile(profile);
    this.profileOpen.set(false);
    this.savedToast.set('Profil gespeichert — Tagesbedarf aktualisiert.');
  }

  /** Prüft ohne KI-Kosten, ob der globale KI-Dienst erreichbar ist. */
  async testAi(): Promise<void> {
    this.aiTest.set({ busy: true, ok: null, message: 'Prüfe Verbindung…' });
    const result = await this.aiService.testConnection();
    this.aiTest.set({ busy: false, ok: result.ok, message: result.message });
  }

  /** Fragt vor dem unwiderruflichen Löschen aller lokalen Daten nach. */
  async confirmReset(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Alle Daten löschen?',
      message:
        'Profil, Tagebuch, Gewichtsverlauf, Favoriten, Rezepte, gespeicherte Mahlzeiten, eigene Lebensmittel, Einkaufsliste und Einstellungen werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Löschen', role: 'destructive', handler: () => this.resetData() },
      ],
    });
    await alert.present();
  }

  resetData(): void {
    this.profileStore.clear();
    this.diary.clear();
    this.recipes.clear();
    this.customFoods.clear();
    this.savedMeals.clear();
    this.shopping.clear();
    this.weekPlan.clear();
    this.weightStore.clear();
    this.favoriteStore.clear();
    this.settingsStore.clear();
    this.appSettings.clear();
    this.storage.clearAll();
    this.savedToast.set('Alle Daten wurden zurückgesetzt.');
  }

  /** Exportiert alle Daten als JSON (Teilen-Menü auf iOS, sonst Download). */
  async exportBackup(): Promise<void> {
    this.backupBusy.set(true);
    try {
      const result = await this.backup.exportBackup();
      if (result === 'shared') this.savedToast.set('Backup erstellt.');
      if (result === 'downloaded') this.savedToast.set('Backup heruntergeladen.');
    } catch {
      await this.showBackupError('Backup nicht erstellt', 'Das Backup konnte nicht erstellt werden. Bitte erneut versuchen.');
    } finally {
      this.backupBusy.set(false);
    }
  }

  /** Datei aus der Auswahl lesen, prüfen und Import bestätigen lassen. */
  async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // gleiche Datei erneut wählbar
    if (!file) return;
    this.backupBusy.set(true);
    try {
      const result = await this.backup.readFile(file);
      if (!result.ok) {
        await this.showBackupError('Backup kann nicht gelesen werden', result.error);
        return;
      }
      await this.confirmImport(result.backup);
    } finally {
      this.backupBusy.set(false);
    }
  }

  private async confirmImport(backup: BackupFile): Promise<void> {
    const date = formatBackupDate(backup.exportedAt) ?? 'unbekannt';
    const alert = await this.alertCtrl.create({
      header: 'Backup importieren?',
      message: `Backup vom ${date}: ${describeCounts(countBackup(backup.data))}. Alle aktuellen Daten auf diesem Gerät werden dadurch ersetzt.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Ersetzen', role: 'destructive', handler: () => this.applyImport(backup) },
      ],
    });
    await alert.present();
  }

  /** Schreibt das Backup und lädt die App neu, damit alle Stores den neuen Stand lesen. */
  private applyImport(backup: BackupFile): void {
    if (!this.backup.restore(backup)) {
      void this.showBackupError('Import fehlgeschlagen', 'Der Import ist fehlgeschlagen (Speicher voll oder gesperrt). Deine bisherigen Daten sind unverändert.');
      return;
    }
    this.win?.location.reload();
  }

  private async showBackupError(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  onToastDismiss(): void {
    this.savedToast.set(null);
  }

  async testConnection(): Promise<void> {
    const url = defaultAiProxyUrl();
    if (!url) { this.debugLog.error('Keine Proxy-URL konfiguriert.'); return; }
    this.debugLog.info(`Teste ${url} ...`);
    this.logOpen.set(true);

    // Test 1: OPTIONS (CORS preflight)
    try {
      const opts = await fetch(`${url}/off-search?q=test&page_size=1&fields=code`, { method: 'OPTIONS' });
      const cors = opts.headers.get('Access-Control-Allow-Origin');
      this.debugLog.info(`OPTIONS → ${opts.status} | CORS: ${cors ?? 'FEHLT!'}`);
    } catch (e) {
      this.debugLog.error(`OPTIONS fehlgeschlagen: ${(e as Error).message}`);
    }

    // Test 2: GET /off-search
    try {
      const resp = await fetch(`${url}/off-search?q=test&page_size=1&fields=code,product_name`);
      const cors = resp.headers.get('Access-Control-Allow-Origin');
      const body = await resp.text();
      this.debugLog.log(resp.ok ? 'success' : 'error',
        `GET /off-search → ${resp.status} | CORS: ${cors ?? 'FEHLT!'} | Body: ${body.slice(0, 80)}`);
    } catch (e) {
      this.debugLog.error(`GET /off-search fehlgeschlagen: ${(e as Error).message}`);
    }

    // Test 3: POST / (ohne API Key)
    try {
      const resp = await fetch(`${url}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: 'ping', payload: {} }),
      });
      const cors = resp.headers.get('Access-Control-Allow-Origin');
      this.debugLog.info(`POST / → ${resp.status} | CORS: ${cors ?? 'FEHLT!'}`);
    } catch (e) {
      this.debugLog.error(`POST / fehlgeschlagen: ${(e as Error).message}`);
    }
  }
}
