import { TOAST_SWIPE_GESTURE } from '../shared/toast-options';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { filter } from 'rxjs';
import { describeDietPrefs } from '../core/diet/diet-search';
import { dietPrefsOf } from '../core/diet/diet-prefs';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { MealsStore } from '../core/state/meals.store';
import { formatDecimal } from '../core/util/number-input';
import { NutritionCalcService } from '../core/nutrition/nutrition-calc.service';
import { defaultAiProxyUrl } from '../core/ai/ai-endpoint';
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
import { backupStatusLabel, goalLabel, hasManualTarget } from './settings-view';
import { BackupService } from '../core/backup/backup.service';
import { isSetupLink } from './setup-link';
import { InfoSectionId, infoLinkSection } from './info-link';
import { consentStatusLabel } from './settings-view';
import { ConsentService } from '../core/consent/consent.service';
import { ConsentStore } from '../core/consent/consent.store';
import { consentDateLabel } from '../core/consent/consent.model';
import { BackupCleanup, BackupFile, countBackup, describeCounts, formatBackupDate } from '../core/backup/backup';
import { describeSafetySnapshot } from '../core/backup/backup-safety';


/**
 * Einstellungen: Profil (eigenes Sheet), KI-Status, Backup und Rechtliches.
 * Der Einrichtungslink (?setup=1) öffnet das Profil und wird danach entfernt.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly profileStore = inject(ProfileStore);
  private readonly router = inject(Router);
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
  readonly formatDecimal = formatDecimal;
  private readonly calc = inject(NutritionCalcService);
  private readonly alertCtrl = inject(AlertController);
  private readonly win = inject(DOCUMENT).defaultView;

  /** Entwickler-Werkzeuge nur mit `?debug=1` (Flag bleibt in localStorage erhalten). */
  readonly debugMode = resolveDebugMode(this.win?.location.search ?? '', safeLocalStorage(this.win));

  readonly target = this.profileStore.target;
  /** Ziel des gespeicherten Profils als Lesetext (z. B. „Abnehmen“), sonst null. */
  readonly dietSummary = computed(() => describeDietPrefs(dietPrefsOf(this.profileStore.profile())));
  readonly profileGoalLabel = computed(() => goalLabel(this.profileStore.profile()?.goal));
  /** Das Tagesziel ist ganz oder teilweise manuell festgelegt (Karte zeigt „manuell“). */
  readonly isManualTarget = computed(() => hasManualTarget(this.profileStore.profile()));
  readonly savedToast = signal<string | null>(null);
  readonly toastSwipe = TOAST_SWIPE_GESTURE;

  readonly profileOpen = signal(false);
  /** Gewicht, das das Profil-Sheet beim Öffnen vorbelegt (Hinweis „Ziel neu berechnen“). */
  readonly prefillWeight = signal<number | null>(null);
  readonly logOpen = signal(false);
  readonly infoSection = signal<InfoSectionId | null>(null);

  private readonly consentStore = inject(ConsentStore);
  private readonly consentService = inject(ConsentService);
  readonly consentStored = this.consentStore.granted;
  readonly consentMinor = this.consentService.minor;
  readonly consentStatus = computed(() =>
    consentStatusLabel(this.consentStore.granted(), consentDateLabel(this.consentStore.acceptedAt()), this.consentMinor()),
  );

  private readonly backup = inject(BackupService);
  readonly backupBusy = signal(false);
  readonly lastBackupLabel = computed(() => backupStatusLabel(formatBackupDate(this.backup.lastBackup())));

  readonly debugLog = inject(DebugLogService);
  readonly logEntries = this.debugLog.entries;

  constructor() {
    // Ionic hält die Seite im Cache: ngOnInit läuft nur einmal. Darum jede Navigation prüfen.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((e) => this.handleNavigation(e.urlAfterRedirects));
  }

  ngOnInit(): void {
    this.refreshSafetyInfo();
  }

  /** Einrichtungslink: Profil öffnen und den Parameter entfernen, damit er nicht erneut greift. */
  private handleNavigation(url: string): void {
    const tree = this.router.parseUrl(url);
    const info = infoLinkSection(tree);
    if (info) {
      this.infoSection.set(info);
      void this.router.navigate(['/settings'], { replaceUrl: true });
      return;
    }
    if (!isSetupLink(tree)) return;
    this.openProfile(null);
    void this.router.navigate(['/settings'], { replaceUrl: true });
  }

  /** Öffnet die gemeinsame Zustimmung (Dialog) aus der Einstellungszeile. */
  async grantConsent(): Promise<void> {
    await this.consentService.ensure();
  }

  revokeConsent(): void {
    this.consentStore.revoke();
    this.savedToast.set('Zustimmung widerrufen. Es wird nichts mehr an Dritte gesendet.');
  }

  openProfile(prefillKg: number | null): void {
    this.prefillWeight.set(prefillKg);
    this.profileOpen.set(true);
  }

  /** Hinweis „Ziel neu berechnen“: Profil mit dem zuletzt gewogenen Gewicht öffnen (nichts wird automatisch gespeichert). */
  recalculateWithWeight(kg: number): void {
    this.openProfile(kg);
  }

  onProfileClosed(): void {
    this.profileOpen.set(false);
    this.prefillWeight.set(null);
  }

  /** Beschreibung der automatischen Sicherung (leer, wenn es keine gibt). */
  readonly safetyInfo = signal<string | null>(null);

  private refreshSafetyInfo(): void {
    const snapshot = this.backup.readSafetySnapshot();
    this.safetyInfo.set(snapshot ? describeSafetySnapshot(snapshot) : null);
  }

  /** Aktuelles Profil nutzt die Mindestzufuhr statt der Formel. */
  get savedMinKcalApplied(): boolean {
    const p = this.profileStore.profile();
    return p !== null && this.calc.isMinKcalApplied(p);
  }

  /** Fragt vor dem Löschen aller lokalen Daten nach und bietet vorher ein Backup an. */
  async confirmReset(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Alle Daten löschen?',
      message:
        `Profil, Tagebuch, Gewichtsverlauf, Favoriten, Rezepte, gespeicherte Mahlzeiten, eigene Lebensmittel, Einkaufsliste und Einstellungen werden von diesem Gerät gelöscht. ${this.lastBackupLabel()}. Zur Sicherheit bleibt eine automatische Sicherung auf diesem Gerät, bis du sie unter Daten löschst.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Backup zuerst', handler: () => void this.exportThen(() => this.confirmReset()) },
        { text: 'Löschen', role: 'destructive', handler: () => this.resetData() },
      ],
    });
    await alert.present();
  }

  /** Exportiert ein Backup und öffnet danach den Dialog erneut, damit nichts ohne Sicherung gelöscht wird. */
  private async exportThen(next: () => Promise<void>): Promise<void> {
    await this.exportBackup();
    await next();
  }

  resetData(): void {
    const safety = this.backup.takeResetSnapshot();
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
    this.consentStore.revoke();
    const safetySaved = this.backup.completeReset(safety);
    this.refreshSafetyInfo();
    this.savedToast.set(
      safety && safetySaved ? 'Alle Daten wurden zurückgesetzt. Eine automatische Sicherung liegt unter Daten.' : 'Alle Daten wurden zurückgesetzt.',
    );
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
      await this.confirmImport(result.backup, result.cleanup);
    } finally {
      this.backupBusy.set(false);
    }
  }

  private async confirmImport(backup: BackupFile, cleanup: BackupCleanup): Promise<void> {
    const date = formatBackupDate(backup.exportedAt) ?? 'unbekannt';
    const skipped = cleanup.skipped > 0 ? ` ${cleanup.skipped} beschädigte Einträge werden übersprungen und gesichert.` : '';
    const alert = await this.alertCtrl.create({
      header: 'Backup importieren?',
      message: `Backup vom ${date}: ${describeCounts(countBackup(backup.data))}. Alle aktuellen Daten auf diesem Gerät werden dadurch ersetzt. Der aktuelle Stand wird vorher automatisch gesichert.${skipped}`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Erst Backup exportieren', handler: () => void this.exportThen(() => this.confirmImport(backup, cleanup)) },
        { text: 'Ersetzen', role: 'destructive', handler: () => void this.applyImport(backup, cleanup) },
      ],
    });
    await alert.present();
  }

  /** Schreibt das Backup und lädt die App neu, damit alle Stores den neuen Stand lesen. */
  private async applyImport(backup: BackupFile, cleanup: BackupCleanup): Promise<void> {
    const result = this.backup.restore(backup, cleanup);
    if (!result.ok) {
      await this.showBackupError('Import fehlgeschlagen', 'Der Import ist fehlgeschlagen (Speicher voll oder gesperrt). Deine bisherigen Daten sind unverändert.');
      return;
    }
    if (result.safetySaved) {
      this.win?.location.reload();
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Import abgeschlossen',
      message: 'Das Backup wurde eingespielt. Für die automatische Sicherung des alten Stands war nicht genug Speicher frei.',
      buttons: [{ text: 'OK', handler: () => this.win?.location.reload() }],
    });
    await alert.present();
  }

  /** Fragt nach, ob die automatische Sicherung wiederhergestellt oder gelöscht werden soll. */
  async confirmRestoreSafety(): Promise<void> {
    const info = this.safetyInfo();
    if (!info) return;
    const alert = await this.alertCtrl.create({
      header: 'Automatische Sicherung',
      message: `${info}. Beim Wiederherstellen wird der aktuelle Stand selbst zur automatischen Sicherung.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Sicherung löschen', role: 'destructive', handler: () => this.discardSafety() },
        { text: 'Wiederherstellen', handler: () => void this.restoreSafety() },
      ],
    });
    await alert.present();
  }

  private discardSafety(): void {
    this.backup.discardSafetySnapshot();
    this.refreshSafetyInfo();
    this.savedToast.set('Automatische Sicherung gelöscht.');
  }

  private async restoreSafety(): Promise<void> {
    const result = this.backup.restoreSafetySnapshot();
    if (!result.ok) {
      await this.showBackupError('Wiederherstellen fehlgeschlagen', 'Die Sicherung konnte nicht eingespielt werden (Speicher voll oder gesperrt). Deine aktuellen Daten sind unverändert.');
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
