import { TOAST_SWIPE_GESTURE } from '../shared/toast-options';
import { selectAllOnFocus } from '../core/keyboard/select-all';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { lightHaptic } from '../diary/haptics';
import { clearQueryParams, pickParam } from '../core/navigation/query-params';
import { formatDecimal, parseDecimal, parseNutrientInput } from '../core/util/number-input';
import { UNIT_OPTIONS } from '../core/util/units';
import { AiService } from '../core/ai/ai.service';
import { MealType, ShoppingItem } from '../core/models';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { ShoppingStore, itemPrice, sumItems } from '../core/state/shopping.store';
import { AppSettingsStore } from '../core/state/app-settings.store';
import { formatQuantity } from '../core/shopping/units/unit-format';
import { WeekPlanStore } from '../core/state/week-plan.store';
import { WeekPlanService } from '../core/week-plan/week-plan.service';
import { UNDO_TOAST_BUTTONS, UNDO_TOAST_MS, UndoableDelete, settleUndoToast } from '../meals/undoable-delete';
import {
  BUDGET_PRESETS,
  DAYS_MAX,
  DAYS_MIN,
  DAY_PRESETS,
  PERSONS_MAX,
  PERSONS_MIN,
  ShoppingRow,
  adjustIndex,
  categoryLabel,
  decodeIndexes,
  defaultPersonsInRange,
  encodeIndexes,
  formatShareText,
  groupByCategory,
  splitRows,
} from './shopping-list.util';

export type { ShoppingRow } from './shopping-list.util';

/** Eine wählbare Mahlzeit im Generator. */
export interface MealToggle {
  value: MealType;
  label: string;
  checked: boolean;
}

/** Ansichten der Einkaufsseite: Rezepte (Generator) oder Liste (Einkauf). */
export type ShoppingView = 'recipes' | 'list';

/** Werte von `?view=` (Link-Wert -> Ansicht): `plan` ist der Wochenplan. */
const QUERY_VIEWS: Readonly<Record<string, ShoppingView>> = { plan: 'recipes', list: 'list' };

/** Dauer des Hinweises nach „Liste teilen“ in ms. */
const SHARE_TOAST_MS = 2500;
/** Dauer des Hinweises nach „Wochenplan erstellt“: länger, damit die Aktion „Zur Liste“ erreichbar bleibt (kein Rückgängig-Hinweis). */
const PLAN_TOAST_MS = 6000;
const PLAN_TOAST_LIST_ROLE = 'list';

/**
 * Einkaufsliste: generiert einen Wocheneinkauf (Personen × Tage × Mahlzeiten ×
 * Budget) über den KI-Anbieter inkl. Schätzpreisen; abhaken/ergänzen/löschen.
 */
@Component({
  selector: 'app-shopping',
  templateUrl: './shopping.page.html',
  styleUrls: ['./shopping.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPage implements OnDestroy {
  private readonly store = inject(ShoppingStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly ai = inject(AiService);
  private readonly recipeStore = inject(RecipeStore);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly weekPlanService = inject(WeekPlanService);
  private readonly weekPlanStore = inject(WeekPlanStore);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap);

  constructor() {
    // Deep Link `?view=plan|list`: einmal übernehmen, dann aus der URL entfernen.
    effect(() => {
      const requested = pickParam(this.queryParams(), 'view', Object.keys(QUERY_VIEWS));
      if (!requested) return;
      this.setView(QUERY_VIEWS[requested]);
      void clearQueryParams(this.router, ['view']);
    });
  }

  /** Eine ID = Komma-Liste von Indizes (Einzel- oder Sammel-Löschen). */
  private readonly deletion = new UndoableDelete((id) => this.commitRemoval(decodeIndexes(id)));
  readonly undoOpen = signal(false);
  readonly undoMessage = signal('Position gelöscht');
  readonly undoDuration = UNDO_TOAST_MS;
  readonly undoButtons = UNDO_TOAST_BUTTONS;

  readonly list = this.store.list;

  /** Positionen ohne die gerade zum Löschen vorgemerkten (Index = Position in der Liste). */
  readonly rows = computed<ShoppingRow[]>(() => {
    const pending = new Set(decodeIndexes(this.deletion.pendingId()));
    return (this.list()?.items ?? [])
      .map((item, index) => ({ item, index }))
      .filter((r) => !pending.has(r.index));
  });

  private readonly split = computed(() => splitRows(this.rows()));
  /** Offene Positionen, nach Supermarkt-Kategorie gruppiert (falls vorhanden). */
  readonly openGroups = computed(() => groupByCategory(this.split().open));
  readonly openCount = computed(() => this.split().open.length);
  /** Abgehakte Positionen für den Bereich „Erledigt“. */
  readonly doneRows = computed(() => this.split().done);
  /** Ob „Erledigt (n)“ aufgeklappt ist. */
  readonly doneOpen = signal(false);

  readonly shareToastOpen = signal(false);
  readonly shareToastMessage = signal('');
  readonly shareToastDuration = SHARE_TOAST_MS;

  /** Summe aus den sichtbaren Positionen; nur echte bzw. eingetragene Preise zählen. */
  readonly totals = computed(() => {
    const all = this.rows().map((r) => r.item);
    const sum = sumItems(all);
    const open = sumItems(all.filter((i) => !i.checked));
    return { total: sum.total, unpriced: sum.unpriced, open: open.total, priced: all.length - sum.unpriced };
  });

  /** Echte KI-Verbindung aktiv (nur dann gibt es geschätzte Preise, Budget und Markt). */
  readonly live = computed(() => this.ai.isLive());
  /** Ohne eigene Rezepte gibt es nichts zu planen, auch mit KI nicht (keine Anfrage mit leerer Rezeptliste). */
  readonly hasRecipes = computed(() => this.recipeStore.recipes().length > 0);
  readonly noRecipesBlock = computed(() => !this.hasRecipes());
  /** Summen zeigen, sobald die Liste Positionen hat (Preise werden immer geschätzt). */
  readonly showTotals = computed(() => this.totals().priced > 0);

  readonly personsMin = PERSONS_MIN;
  readonly personsMax = PERSONS_MAX;
  readonly daysMin = DAYS_MIN;
  readonly daysMax = DAYS_MAX;
  readonly dayPresets = DAY_PRESETS;
  readonly budgetPresets = BUDGET_PRESETS;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Aktive Ansicht; bleibt über Tab-Wechsel im Seitenzustand erhalten (Standard: Liste). */
  readonly view = signal<ShoppingView>('list');
  readonly isListView = computed(() => this.view() === 'list');
  /** Rezepte-Segment sichtbar (Wochenplan und Generator). */
  readonly showGenerator = computed(() => this.view() === 'recipes');

  /** Aktueller Wochenplan (Online-Rezepte). */
  readonly weekPlan = this.weekPlanStore.plan;
  /** Online-Suche (eigener Key oder globaler Worker) erreichbar. */
  readonly onlineAvailable = computed(() => this.weekPlanService.isAvailable());
  /** Generator ausgeklappt; ohne Plan immer, mit Plan nur auf Wunsch. */
  readonly generatorOpen = signal(false);
  /** Schalter "Aus meinen Rezepten planen"; ohne Online-Rezeptsuche ist er erzwungen an. */
  private readonly ownRecipes = signal(false);
  readonly ownMode = computed(() => this.ownRecipes() || !this.onlineAvailable());
  readonly showForm = computed(() => this.weekPlan() === null || this.generatorOpen());
  readonly planToastOpen = signal(false);
  readonly planToastMessage = signal('');
  readonly planToastButtons = [{ text: 'Zur Liste', role: PLAN_TOAST_LIST_ROLE }];
  readonly planToastDuration = PLAN_TOAST_MS;
  readonly toastSwipe = TOAST_SWIPE_GESTURE;

  /** Vorbelegung aus dem Profil, sonst aus der letzten generierten Liste. */
  persons = defaultPersonsInRange(this.profileStore.profile(), this.lastGeneratedPersons());
  days = 5;
  budget: number | null = null;
  storeName = '';

  readonly mealToggles = signal<MealToggle[]>([
    { value: 'breakfast', label: 'Frühstück', checked: false },
    { value: 'lunch', label: 'Mittag', checked: true },
    { value: 'dinner', label: 'Abend', checked: true },
    { value: 'snack', label: 'Snacks', checked: false },
  ]);

  readonly stores = ['', 'Spar', 'Billa', 'Hofer', 'Lidl', 'Penny'];

  newItemName = '';
  newItemAmountText = '';
  newItemPriceText = '';
  /** Feldfehler im Hinzufügen-Sheet (null = gültig). */
  readonly addAmountError = signal<string | null>(null);
  readonly addPriceError = signal<string | null>(null);
  /** Volle Höhe (Abstand oben kommt aus sheets.scss): Felder bleiben über der iOS-Tastatur (216 + 44 + 44 pt). */
  readonly addBreakpoints = [0, 1];
  readonly addInitialBreakpoint = 1;
  readonly categoryLabel = categoryLabel;
  readonly parseDecimal = parseDecimal;
  readonly formatDecimal = formatDecimal;
  readonly unitOptions = UNIT_OPTIONS;
  // read: ElementRef, sonst liefert viewChild die IonInput-Instanz (ohne nativeElement).
  private readonly addNameInput = viewChild<string, ElementRef<HTMLElement & { setFocus?: () => Promise<void> }>>(
    'addName',
    { read: ElementRef },
  );
  private readonly unitSignal = signal('g');
  /** Signal-gestützt, damit die OnPush-Ansicht die per Action Sheet gewählte Einheit zeigt. */
  get newItemUnit(): string {
    return this.unitSignal();
  }
  set newItemUnit(value: string) {
    this.unitSignal.set(value);
  }
  readonly addOpen = signal(false);

  toggleMeal(value: MealType): void {
    this.mealToggles.update((meals) =>
      meals.map((m) => (m.value === value ? { ...m, checked: !m.checked } : m)),
    );
  }

  /** Wechselt die Ansicht. Ein offenes „Löschen rückgängig“ wird beim Verlassen der Liste bestätigt. */
  setView(view: ShoppingView): void {
    if (view !== 'list') {
      this.deletion.flush();
      this.undoOpen.set(false);
    }
    this.view.set(view);
  }

  /** Segment-Wechsel; unbekannte Werte werden ignoriert. */
  onViewChange(value: unknown): void {
    if (value === 'recipes' || value === 'list') this.setView(value);
  }

  /** „Neu generieren“ in der Liste: zur Rezeptansicht wechseln, Generator offen. */
  openGenerator(): void {
    this.generatorOpen.set(true);
    this.setView('recipes');
  }

  /** „Abbrechen“ im Generator: zurück zur Liste. */
  closeGenerator(): void {
    this.generatorOpen.set(false);
    this.setView('list');
  }

  /** „Neuen Wochenplan erstellen“: klappt den Generator auf. */
  expandGenerator(): void {
    this.generatorOpen.set(true);
  }

  /** „Abbrechen“ im Generator der Rezepte-Ansicht: mit Plan einklappen, sonst zur Liste. */
  cancelGenerator(): void {
    if (this.weekPlan() !== null) {
      this.generatorOpen.set(false);
      return;
    }
    this.closeGenerator();
  }

  /** Toast-Aktion „Zur Liste“ wechselt die Ansicht; jeder Dismiss schließt den Toast. */
  onPlanToastDismiss(event: CustomEvent<{ role?: string }>): void {
    this.planToastOpen.set(false);
    if (event.detail?.role === PLAN_TOAST_LIST_ROLE) this.setView('list');
  }

  ngOnDestroy(): void {
    this.deletion.flush();
  }

  /** Personen der letzten generierten Liste (rein manuelle Listen zählen nicht). */
  private lastGeneratedPersons(): number | undefined {
    const l = this.store.list();
    return l && (l.days ?? null) !== null ? l.persons : undefined;
  }

  private async confirmRegenerate(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Neu generieren?',
      message:
        'Die Liste wird neu berechnet. Abgehakte und selbst hinzugefügte Positionen bleiben erhalten, alle anderen werden ersetzt.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Neu generieren', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  /** Prüft Personen und Tage; setzt bei Fehler die Meldung. */
  private inputsValid(): boolean {
    if (!Number.isInteger(this.persons) || this.persons < 1) {
      this.error.set('Personen: bitte eine ganze Zahl ab 1 angeben.');
      return false;
    }
    if (!Number.isInteger(this.days) || this.days < 1) {
      this.error.set('Tage: bitte eine ganze Zahl ab 1 angeben.');
      return false;
    }
    return true;
  }

  /** Fragt, ob die bisherige Liste ersetzt wird: 'replace' = komplett leeren, 'keep' = Abgehaktes/Eigenes behalten, null = abbrechen. */
  private async confirmNewWeekPlan(): Promise<'replace' | 'keep' | null> {
    const alert = await this.alertCtrl.create({
      header: 'Neuen Wochenplan erstellen?',
      message:
        'Der bisherige Wochenplan wird ersetzt. Soll die Einkaufsliste komplett überschrieben werden oder sollen abgehakte und selbst hinzugefügte Positionen bleiben?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Positionen behalten', role: 'keep' },
        { text: 'Liste überschreiben', role: 'replace' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'replace' || role === 'keep' ? role : null;
  }

  private selectedMeals(): MealType[] {
    const meals = this.mealToggles()
      .filter((m) => m.checked)
      .map((m) => m.value);
    return meals.length ? meals : ['dinner'];
  }

  /** Wochenplan aus Online-Rezepten erstellen; Zutaten landen in der Einkaufsliste. */
  setOwnRecipes(checked: boolean): void {
    this.ownRecipes.set(checked);
  }

  async generateWeekPlan(): Promise<void> {
    if (!this.inputsValid()) return;
    this.deletion.flush();
    const hasListItems = (this.list()?.items.length ?? 0) > 0;
    let keepExisting = true;
    if (this.weekPlan() !== null || hasListItems) {
      const choice = await this.confirmNewWeekPlan();
      if (choice === null) return;
      keepExisting = choice === 'keep';
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      const { itemCount } = await this.weekPlanService.generate({
        persons: this.persons,
        days: this.days,
        meals: this.selectedMeals(),
        keepExisting,
      });
      this.generatorOpen.set(false);
      this.planToastMessage.set(`Wochenplan erstellt, ${itemCount} Zutaten in der Liste`);
      this.planToastOpen.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Wochenplan konnte nicht erstellt werden.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Fallback: Wocheneinkauf aus den eigenen Rezepten (ShoppingStore.generatePlan). */
  async generate(): Promise<void> {
    if (!this.inputsValid() || this.noRecipesBlock()) return;
    this.deletion.flush();
    const existing = this.list();
    if (existing && existing.items.length > 0 && !(await this.confirmRegenerate())) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.store.generatePlan({
        persons: this.persons,
        days: this.days,
        meals: this.selectedMeals(),
        budget: this.budget ?? undefined,
        store: this.storeName || undefined,
      });
      this.generatorOpen.set(false);
      this.setView('list');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Generierung fehlgeschlagen.');
    } finally {
      this.loading.set(false);
    }
  }

  toggle(index: number): void {
    this.store.toggleItem(index);
  }

  /** Setzt den Haken auf den gewünschten Zustand; doppelte Events ändern nichts. */
  setChecked(index: number, checked: boolean): void {
    const item = this.list()?.items[index];
    if (!item || item.checked === checked) return;
    lightHaptic();
    this.store.toggleItem(index);
  }

  /** Blendet die Position aus und zeigt „Gelöscht – Rückgängig“. */
  removeItem(index: number): void {
    // Ein offenes früheres Löschen wird endgültig und verschiebt spätere Indizes.
    const pending = decodeIndexes(this.deletion.pendingId());
    this.deletion.flush();
    this.startDeletion([adjustIndex(index, pending)], 'Position gelöscht');
  }

  /** Blendet alle abgehakten Positionen aus („Erledigte entfernen“, mit Rückgängig). */
  removeChecked(): void {
    this.deletion.flush();
    const checked = (this.list()?.items ?? [])
      .map((item, index) => ({ item, index }))
      .filter((r) => r.item.checked)
      .map((r) => r.index);
    if (checked.length === 0) return;
    const message =
      checked.length === 1 ? '1 erledigte Position entfernt' : `${checked.length} erledigte Positionen entfernt`;
    this.startDeletion(checked, message);
  }

  toggleDone(): void {
    this.doneOpen.update((open) => !open);
  }

  onUndoDismiss(event: CustomEvent<{ role?: string }>): void {
    settleUndoToast(this.deletion, event.detail?.role);
    this.undoOpen.set(false);
  }

  private startDeletion(indexes: readonly number[], message: string): void {
    this.deletion.start(encodeIndexes(indexes));
    this.undoMessage.set(message);
    this.undoOpen.set(true);
  }

  /** Entfernt endgültig, von hinten nach vorn, damit Indizes gültig bleiben. */
  private commitRemoval(indexes: readonly number[]): void {
    [...indexes].sort((a, b) => b - a).forEach((i) => this.store.removeItem(i));
  }

  /** Teilt die offenen Positionen per Web Share API; sonst Zwischenablage + Hinweis. */
  async shareList(): Promise<void> {
    if (this.openCount() === 0) {
      this.showShareToast('Nichts zu teilen: alle Positionen sind erledigt.');
      return;
    }
    const text = formatShareText(this.rows().map((r) => r.item), 'Einkaufsliste', this.appSettings.unitSystem());
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (typeof nav?.share === 'function') {
      try {
        await nav.share({ title: 'Einkaufsliste', text });
        return;
      } catch (e: unknown) {
        // Abbruch durch den Nutzer ist kein Fehler; sonst Zwischenablage versuchen.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    await this.copyToClipboard(text, nav);
  }

  private async copyToClipboard(text: string, nav: Navigator | undefined): Promise<void> {
    try {
      if (typeof nav?.clipboard?.writeText !== 'function') throw new Error('Zwischenablage nicht verfügbar');
      await nav.clipboard.writeText(text);
      this.showShareToast('Liste in die Zwischenablage kopiert');
    } catch (e: unknown) {
      console.error('Einkaufsliste teilen fehlgeschlagen', e);
      this.showShareToast('Teilen nicht möglich. Bitte erneut versuchen.');
    }
  }

  private showShareToast(message: string): void {
    this.shareToastMessage.set(message);
    this.shareToastOpen.set(true);
  }

  onShareToastDismiss(): void {
    this.shareToastOpen.set(false);
  }

  setBudget(value: number | null): void {
    this.budget = value;
  }

  setDays(value: number): void {
    this.days = value;
  }

  setPersons(value: number): void {
    this.persons = value;
  }

  private readonly appSettings = inject(AppSettingsStore);
  readonly translateProgress = this.weekPlanService.translateProgress;

  /** Menge einer Position im gewählten Einheitensystem. */
  qty(item: ShoppingItem): string {
    return formatQuantity(item.amount, item.unit, item.name, this.appSettings.unitSystem());
  }

  /** Angezeigter Preis (eigener vor geschätzt). */
  shownPrice(item: ShoppingItem): number | undefined {
    return itemPrice(item);
  }

  /** Eigenen Preis einer Position eintragen oder löschen (leer lassen). */
  async editPrice(index: number, draft?: string, errorText?: string): Promise<void> {
    const item = this.list()?.items[index];
    if (!item) return;
    const alert = await this.alertCtrl.create({
      header: 'Preis ändern',
      subHeader: item.name,
      message: errorText ?? 'Eigener Betrag in Euro (€); leer = Schätzung verwenden',
      cssClass: errorText ? 'alert-error' : undefined,
      inputs: [
        {
          name: 'price',
          type: 'text',
          placeholder: '0,00 €',
          value: draft ?? (item.userPrice != null ? formatDecimal(item.userPrice) : ''),
          attributes: { inputmode: 'decimal' },
        },
      ],
      buttons: [
        { text: 'Position löschen', role: 'destructive' },
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Speichern', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { price?: string } }>();
    if (role === 'destructive') {
      this.removeItem(index);
      return;
    }
    if (role !== 'confirm') return;
    const raw = String(data?.values?.price ?? '').trim();
    const parsed = parseNutrientInput(raw);
    if (parsed.error) {
      // Ungültig: Eingabe behalten und erneut fragen, den Preis nicht löschen.
      await this.editPrice(index, raw, parsed.error);
      return;
    }
    this.store.setItemPrice(index, parsed.value);
  }

  openAdd(): void {
    this.addOpen.set(true);
  }

  closeAdd(): void {
    this.addOpen.set(false);
  }

  focusName(): void {
    void this.addNameInput()?.nativeElement.setFocus?.();
  }

  readonly selectAll = selectAllOnFocus;

  async pickUnit(): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: 'Einheit',
      buttons: [
        ...this.unitOptions.map((u) => ({
          text: u,
          role: u === this.newItemUnit ? 'selected' : undefined,
          handler: () => {
            this.newItemUnit = u;
          },
        })),
        { text: 'Abbrechen', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  /** Legt den Artikel an, leert die Felder und lässt das Sheet für den nächsten offen. */
  addManual(): void {
    const name = this.newItemName.trim();
    if (!name) {
      this.focusName();
      return;
    }
    const amountRes = parseNutrientInput(this.newItemAmountText);
    const priceRes = parseNutrientInput(this.newItemPriceText);
    this.addAmountError.set(amountRes.error);
    this.addPriceError.set(priceRes.error);
    if (amountRes.error || priceRes.error) return;
    const price = priceRes.value;
    this.store.addItem({
      name,
      // Leer = „ohne Menge“.
      amount: amountRes.value ?? 0,
      unit: this.newItemUnit || 'g',
      checked: false,
      ...(price !== null && price > 0 ? { userPrice: price } : {}),
    });
    this.newItemName = '';
    this.newItemAmountText = '';
    this.newItemPriceText = '';
    this.newItemUnit = 'g';
    this.focusName();
  }

  overBudget(): boolean {
    const l = this.list();
    return !!l && l.budget != null && this.totals().total > l.budget;
  }
}
