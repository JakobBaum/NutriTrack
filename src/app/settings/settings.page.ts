import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { ActivityLevel, AiConfig, Goal, Sex, UserProfile } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { MealsStore } from '../core/state/meals.store';
import { formatDecimal, parseDecimal } from '../core/util/number-input';
import { StorageService } from '../core/storage/storage.service';
import { NutritionCalcService } from '../core/nutrition/nutrition-calc.service';
import { CustomFoodStore } from '../core/state/custom-food.store';
import { SettingsStore } from '../core/state/settings.store';
import { ShoppingStore } from '../core/state/shopping.store';
import { DebugLogService } from '../core/debug/debug-log.service';
import { resolveDebugMode, safeLocalStorage } from './debug-flag';
import { BackupService } from '../core/backup/backup.service';
import { BackupFile, countBackup, describeCounts, formatBackupDate } from '../core/backup/backup';

/**
 * Einstellungen: Profil erfassen → Tagesbedarf berechnen (deterministisch),
 * KI-Anbieter konfigurieren (lokal gespeichert) und Daten zurücksetzen.
 */
/** Ab diesem Tempo (kg/Woche) zeigt das Formular eine Warnung. */
const RATE_WARN_KG_PER_WEEK = 0.75;

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
  private readonly diary = inject(DiaryStore);
  private readonly recipes = inject(RecipeStore);
  private readonly customFoods = inject(CustomFoodStore);
  private readonly shopping = inject(ShoppingStore);
  private readonly savedMeals = inject(MealsStore);
  private readonly storage = inject(StorageService);
  readonly parseDecimal = parseDecimal;
  readonly formatDecimal = formatDecimal;
  private readonly calc = inject(NutritionCalcService);
  private readonly alertCtrl = inject(AlertController);
  private readonly win = inject(DOCUMENT).defaultView;

  /** Entwickler-Werkzeuge nur mit `?debug=1` (Flag bleibt in localStorage erhalten). */
  readonly debugMode = resolveDebugMode(this.win?.location.search ?? '', safeLocalStorage(this.win));

  readonly target = this.profileStore.target;
  readonly error = signal<string | null>(null);
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
  weightKg: number | null = this.existing?.weightKg ?? 80;
  heightCm: number | null = this.existing?.heightCm ?? 180;
  age: number | null = this.existing?.age ?? 30;
  sex: Sex = this.existing?.sex ?? 'male';
  activityLevel: ActivityLevel = this.existing?.activityLevel ?? 'moderate';
  goal: Goal = this.existing?.goal ?? 'maintain';
  rateKgPerWeek: number | null = this.existing?.rateKgPerWeek ?? 0.5;

  // --- KI-Konfiguration (Kopie zum Bearbeiten) ---
  ai: AiConfig = { ...this.settingsStore.ai() };

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

  readonly providers = [
    { value: 'mock', label: 'Demo (ohne KI)' },
    { value: 'gemini', label: 'Gemini direkt (eigener Key)' },
  ];

  private readonly ranges = {
    weightKg: { min: 30, max: 300, label: 'Gewicht' },
    heightCm: { min: 100, max: 250, label: 'Größe' },
    age: { min: 14, max: 100, label: 'Alter' },
    rateKgPerWeek: { min: 0.1, max: 1.5, label: 'Tempo' },
  } as const;

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

  /** Formular (falls vollstaendig) ergibt ein Ziel unter der Mindestzufuhr. */
  get formMinKcalApplied(): boolean {
    const w = Number(this.weightKg), h = Number(this.heightCm), a = Number(this.age);
    if (![w, h, a].every((n) => Number.isFinite(n) && n > 0)) return false;
    const rate = this.showRate ? Number(this.rateKgPerWeek) : 0;
    return this.calc.isMinKcalApplied({
      weightKg: w, heightCm: h, age: a, sex: this.sex, activityLevel: this.activityLevel,
      goal: this.goal, rateKgPerWeek: Number.isFinite(rate) ? rate : 0, updatedAt: '',
    });
  }

  /** Warnung bei zu schnellem Tempo. */
  get rateWarning(): boolean {
    return this.showRate && Number(this.rateKgPerWeek) > RATE_WARN_KG_PER_WEEK;
  }

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
    this.profileOpen.set(false);
    this.savedToast.set('Profil gespeichert — Tagesbedarf aktualisiert.');
  }

  saveAi(): void {
    this.settingsStore.setAi({ ...this.ai });
    this.aiOpen.set(false);
    this.savedToast.set('KI-Einstellungen gespeichert.');
  }

  /** Fragt vor dem unwiderruflichen Löschen aller lokalen Daten nach. */
  async confirmReset(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Alle Daten löschen?',
      message:
        'Profil, Tagebuch, Rezepte, gespeicherte Mahlzeiten, eigene Lebensmittel, Einkaufsliste und Einstellungen werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.',
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
    this.settingsStore.clear();
    this.storage.clearAll();
    this.ai = { ...this.settingsStore.ai() };
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
      await this.showBackupError('Das Backup konnte nicht erstellt werden. Bitte erneut versuchen.');
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
        await this.showBackupError(result.error);
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
      void this.showBackupError('Der Import ist fehlgeschlagen (Speicher voll oder gesperrt). Deine bisherigen Daten sind unverändert.');
      return;
    }
    this.win?.location.reload();
  }

  private async showBackupError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Backup', message, buttons: ['OK'] });
    await alert.present();
  }

  onToastDismiss(): void {
    this.savedToast.set(null);
  }

  async testConnection(): Promise<void> {
    const url = this.settingsStore.ai().proxyUrl?.trim().replace(/\/$/, '');
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
