import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import type { IScannerControls } from '@zxing/browser';
import { AmountUnit, DiaryEntry, FastFoodSuggestion, FoodItem, MealType, NutritionFacts, Recipe, SavedMeal } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { FOOD_PROVIDER } from '../core/food/food-provider';
import { foodErrorMessage } from '../core/food/food-errors';
import { CameraService } from '../core/scan/camera.service';
import { BarcodeScannerService } from '../core/scan/barcode-scanner.service';
import { OpenPricesProvider } from '../core/price/open-prices.provider';
import { CopySource, DiaryStore, NewDiaryEntry } from '../core/state/diary.store';
import { MealsStore } from '../core/state/meals.store';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { CustomFood, CustomFoodStore } from '../core/state/custom-food.store';
import { addDaysISO, dayLabel, toDateISO } from '../core/util/date';
import { formatNum } from '../shared/num.pipe';
import { countMissingFacts } from '../recipes/recipe-view';
import { copyFromButtonText, copyFromText, copySourceOptionText, entriesKcal, entryCountText } from './diary-copy';
import {
  EMPTY_FIELDS,
  EntryFields,
  MEAL_DEFS,
  factsDiffer,
  factsFromFields,
  fieldsFromFacts,
  isIsoDate,
  isMealType,
  isValidAmount,
  mealForHour,
  mealLabel,
  rebaseTo100,
  scaleFacts,
  toNumberOrNull,
  quickAmounts,
  inputTextFor,
  unitForName,
  AMOUNT_UNITS,
  formatAmount,
  baseUnitOf,
  fromBaseAmount,
  toBaseAmount,
  convertAmount,
  lastAmountForLabel,
  perServingFacts,
  editBaseFor,
} from './diary-helpers';

interface MealGroup {
  type: MealType;
  label: string;
  icon: string;
  entries: DiaryEntry[];
  kcal: number;
  /** Letzter früherer Tag mit Einträgen dieser Mahlzeit; nur gesetzt, wenn die Mahlzeit leer ist. */
  copySource: CopySource | null;
}

type AddView = 'search' | 'form' | 'recipes' | 'saved' | 'meals';
type QuantityUnit = 'g' | 'portion';

/** Bezugswerte, aus denen die Formularfelder bei Mengenänderung neu berechnet werden. */
interface ScaleBase {
  facts: NutritionFacts;
  unit: QuantityUnit;
}

interface EntryForm extends EntryFields {
  label: string;
  meal: MealType;
  amountG: number | null;
  servings: number | null;
}

interface ApplyOptions {
  amountG?: number;
  unit?: AmountUnit;
  servings?: number;
  recipeId?: string;
  isAi?: boolean;
  isPartial?: boolean;
  hint?: string;
}

interface FastFoodForm {
  restaurant: string;
  kcalBudget: number | null;
  moneyBudget: number | null;
  preference: string;
}

const EMPTY_FORM: EntryForm = {
  ...EMPTY_FIELDS,
  label: '',
  meal: 'breakfast',
  amountG: null,
  servings: null,
};

const DEFAULT_AMOUNT_G = 100;
const MAX_RECENT_FOODS = 8;
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_FOCUS_DELAY_MS = 60;
const AMOUNT_FOCUS_DELAY_MS = 150;
const SCROLL_TO_MEAL_DELAY_MS = 150;
const TOAST_MS = 2500;
const TOAST_UNDO_MS = 5000;
/** rawTexts-Schlüssel des Add-Formulars (Menge, Portionen, Nährwerte). */
const ADD_FORM_TEXT_KEYS: readonly string[] = ['amount', 'servings', ...Object.keys(EMPTY_FIELDS)];
const EDIT_FORM_TEXT_KEYS: readonly string[] = ['editAmount'];

/**
 * Tagebuch: Einträge je Mahlzeit. Hinzufügen läuft über ein Modal, das sofort
 * die Suche zeigt (Suchen → Menge → Speichern); Zuletzt-Benutztes lässt sich
 * mit einem Tipp loggen. Plus Fastfood-Helfer (einzige Implementierung).
 */
@Component({
  selector: 'app-diary',
  templateUrl: './diary.page.html',
  styleUrls: ['./diary.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryPage implements OnDestroy {
  private readonly diary = inject(DiaryStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly recipeStore = inject(RecipeStore);
  private readonly customFoods = inject(CustomFoodStore);
  private readonly mealsStore = inject(MealsStore);
  private readonly food = inject(FOOD_PROVIDER);
  private readonly ai = inject(AiService);
  private readonly camera = inject(CameraService);
  private readonly barcode = inject(BarcodeScannerService);
  private readonly prices = inject(OpenPricesProvider);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  @ViewChild('barcodeVideo') barcodeVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('searchbar') searchbar?: { setFocus(): Promise<void> };
  @ViewChild('amountInput') amountInput?: {
    setFocus(): Promise<void>;
    getInputElement(): Promise<HTMLInputElement>;
  };

  /** Roher Tipptext je Zahlenfeld (erhält z. B. "1," beim Tippen mit Komma). */
  private readonly rawTexts: Record<string, string> = {};

  /** Verwirft den Tipptext der genannten Felder (sonst zeigt ein neuer Eintrag z. B. noch "1,"). */
  private clearRawTexts(keys: readonly string[]): void {
    keys.forEach((key) => delete this.rawTexts[key]);
  }

  readonly selectedDate = signal(toDateISO());
  readonly dateLabel = computed(() => dayLabel(this.selectedDate()));
  readonly isToday = computed(() => this.selectedDate() === toDateISO());

  readonly totalKcal = computed(() =>
    Math.round(this.diary.totalsForDate(this.selectedDate()).kcal),
  );
  readonly targetKcal = computed(() => this.profileStore.target()?.kcal ?? 0);
  /** Verbleibende kcal des gewählten Tages (0, wenn das Ziel erreicht oder überschritten ist). */
  readonly remainingKcal = computed(() => Math.max(0, this.targetKcal() - this.totalKcal()));
  readonly overKcal = computed(() =>
    this.targetKcal() > 0 ? Math.max(0, this.totalKcal() - this.targetKcal()) : 0,
  );

  readonly groups = computed<MealGroup[]>(() => {
    const date = this.selectedDate();
    return MEAL_DEFS.map((d) => {
      const entries = this.diary.entriesForMeal(date, d.type);
      const kcal = entries.reduce((s, e) => s + (e.facts.kcal || 0), 0);
      const copySource = entries.length === 0 ? this.diary.findCopySource(date, d.type) : null;
      return { ...d, entries, kcal: Math.round(kcal), copySource };
    });
  });

  /** Frühere Tage (max. 7 zurück) mit Einträgen, für „Tag kopieren“. */
  readonly daySources = computed(() => this.diary.copySources(this.selectedDate()));

  readonly mealOptions: { value: MealType; label: string }[] = MEAL_DEFS.map((m) => ({
    value: m.type,
    label: m.label,
  }));

  /** Mahlzeit, die zur aktuellen Uhrzeit passt (für Schnellzugriff per FAB). */
  currentMeal(): MealType {
    return mealForHour(new Date().getHours());
  }

  // --- Add-entry modal state ---
  readonly isModalOpen = signal(false);
  readonly view = signal<AddView>('search');
  readonly error = signal<string | null>(null);
  /** Wert der Accordion-Gruppe „Nährwerte anpassen“ ('adjust' = offen). */
  readonly adjustOpen = signal<string | undefined>(undefined);
  /** True, wenn die Werte im Formular aus einer KI-Schätzung stammen. */
  readonly isAiEstimate = signal(false);
  readonly formHint = signal<string | null>(null);
  /** True, wenn die Rezeptwerte unvollständig sind (Zutaten ohne Nährwerte). */
  private isPartialSource = false;
  form: EntryForm = { ...EMPTY_FORM };

  /** Gewähltes Rezept (für die ref des Eintrags), null bei manuell/Food. */
  private pickedRecipeId: string | null = null;
  /** Bezugswerte für die Mengenskalierung; null bei manueller Eingabe. */
  scaleBase: ScaleBase | null = null;
  /** Gewählte Einheit der Mengeneingabe; form.amountG zeigt den Wert in dieser Einheit. */
  amountUnit: AmountUnit = 'g';
  /** True, sobald die Einheit manuell gewählt wurde (stoppt die Namens-Vorgabe). */
  private unitTouched = false;
  readonly amountUnits = AMOUNT_UNITS;
  readonly formatAmount = formatAmount;

  // --- Edit-Modal ---
  readonly editOpen = signal(false);
  private editEntry: DiaryEntry | null = null;
  editForm: { label: string; meal: MealType; amountG: number | null } = {
    label: '', meal: 'breakfast', amountG: null,
  };
  /** Einheit im Bearbeiten-Dialog; editForm.amountG zeigt den Wert in dieser Einheit. */
  editUnit: AmountUnit = 'g';
  editBaseFacts: NutritionFacts | null = null;
  editError: string | null = null;

  /** Freitext-Filter für die Rezept-Auswahl im Add-Modal. */
  readonly recipeQuery = signal('');

  /** Rezepte mit Nährwerten je Portion, optional nach Titel gefiltert. */
  readonly recipeOptions = computed<Recipe[]>(() => {
    const q = this.recipeQuery().trim().toLowerCase();
    const withFacts = this.recipeStore.recipes().filter((r) => !!r.factsPerServing);
    return q ? withFacts.filter((r) => r.title.toLowerCase().includes(q)) : withFacts;
  });

  readonly hasLoggableRecipes = computed(() =>
    this.recipeStore.recipes().some((r) => !!r.factsPerServing),
  );

  /** Freitext-Filter für gespeicherte (eigene) Lebensmittel. */
  readonly customQuery = signal('');

  readonly customFoodOptions = computed<CustomFood[]>(() => {
    const q = this.customQuery().trim().toLowerCase();
    const all = this.customFoods.foods();
    return q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all;
  });

  readonly hasCustomFoods = computed(() => this.customFoods.foods().length > 0);

  /** Gespeicherte Mahlzeiten (Vorlagen aus dem Mahlzeiten-Tab). */
  readonly savedMeals = this.mealsStore.meals;
  readonly hasSavedMeals = computed(() => this.mealsStore.meals().length > 0);

  // --- Food search ---
  searchQuery = '';
  readonly searchResults = signal<FoodItem[]>([]);
  readonly searching = signal(false);
  readonly scanning = signal(false);
  readonly searchHint = signal<string | null>(null);
  readonly searchDebounceMs = SEARCH_DEBOUNCE_MS;
  private searchSeq = 0;

  /** Native Kamera nur auf dem Gerät; im Web → Datei-Upload-Fallback. */
  readonly nativeCamera = this.camera.isNativeCameraAvailable();

  /** Zuletzt benutzte Lebensmittel. */
  readonly recentFoods = computed(() => this.diary.recentFoods(MAX_RECENT_FOODS));

  /** Zuletzt benutzte Rezepte (max. 3) aus Tagebuch-Einträgen. */
  readonly recentRecipes = computed<Recipe[]>(() => {
    const ids = this.diary.recentRecipeIds(3);
    const all = this.recipeStore.recipes();
    return ids
      .map((id) => all.find((r) => r.id === id))
      .filter((r): r is Recipe => !!r && !!r.factsPerServing);
  });

  // --- Barcode scanner modal ---
  readonly bcOpen = signal(false);
  readonly bcError = signal<string | null>(null);
  readonly bcLooking = signal(false);
  readonly bcManualOpen = signal(false);
  manualBarcode = '';
  private scanControls?: IScannerControls;

  // --- Fastfood helper ---
  readonly ffOpen = signal(false);
  readonly ffLoading = signal(false);
  readonly ffResults = signal<FastFoodSuggestion[]>([]);
  /** True, sobald eine Fastfood-Suche gelaufen ist (für den Leerzustand). */
  readonly ffSearched = signal(false);
  ff: FastFoodForm = { restaurant: 'McDonald’s', kcalBudget: null, moneyBudget: null, preference: 'viel Protein' };

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.handleQuery(params));
  }

  ngOnDestroy(): void {
    // Kamera-Stream freigeben, falls der Scanner beim Zerstören noch läuft.
    this.stopScanner();
  }

  /**
   * Liest `?add=<meal>` (öffnet das Add-Modal), `?fastfood=1` (öffnet den
   * Fastfood-Helfer) und `?date=` einmalig und entfernt sie danach aus der URL.
   */
  private handleQuery(params: ParamMap): void {
    const add = params.get('add');
    const wantsFastfood = params.get('fastfood') === '1';
    const meal = params.get('meal');
    if (!add && !wantsFastfood && !meal) return;

    const date = params.get('date');
    if (add) {
      this.selectedDate.set(isIsoDate(date) ? date : toDateISO());
      this.openAdd(isMealType(add) ? add : this.currentMeal());
    }
    if (wantsFastfood) this.openFastfood();
    if (isMealType(meal)) {
      if (isIsoDate(date)) this.selectedDate.set(date);
      setTimeout(() => this.scrollToMeal(meal), SCROLL_TO_MEAL_DELAY_MS);
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { add: null, fastfood: null, date: null, meal: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Scrollt zur Mahlzeit-Gruppe (Deep-Link ?meal=lunch). */
  private scrollToMeal(meal: MealType): void {
    document.getElementById('meal-' + meal)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  prevDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, -1));
  }

  nextDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, 1));
  }

  // --- Add modal: öffnen / schließen / navigieren ---
  openAdd(meal: MealType = this.currentMeal()): void {
    this.form = { ...EMPTY_FORM, meal };
    this.clearRawTexts(ADD_FORM_TEXT_KEYS);
    this.amountUnit = 'g';
    this.unitTouched = false;
    this.pickedRecipeId = null;
    this.scaleBase = null;
    this.recipeQuery.set('');
    this.customQuery.set('');
    this.searchQuery = '';
    this.searchResults.set([]);
    this.searchHint.set(null);
    this.formHint.set(null);
    this.isAiEstimate.set(false);
    this.isPartialSource = false;
    this.adjustOpen.set(undefined);
    this.error.set(null);
    this.view.set('search');
    this.isModalOpen.set(true);
  }

  /** Öffnet das Add-Modal direkt im manuellen Formular (FAB „Manuell“). */
  openAddManual(): void {
    this.openAdd();
    this.openManualEntry();
  }

  closeAdd(): void {
    this.isModalOpen.set(false);
  }

  /** ion-modal didPresent → Suchfeld fokussieren, damit sofort getippt werden kann. */
  focusSearch(): void {
    setTimeout(() => void this.searchbar?.setFocus(), SEARCH_FOCUS_DELAY_MS);
  }

  showView(next: AddView): void {
    this.error.set(null);
    this.view.set(next);
  }

  backToSearch(): void {
    this.showView('search');
    this.focusSearch();
  }

  selectedMealLabel(): string {
    return mealLabel(this.form.meal);
  }

  modalTitle(): string {
    switch (this.view()) {
      case 'recipes': return 'Rezept wählen';
      case 'saved': return 'Eigene Lebensmittel';
      case 'meals': return 'Gespeicherte Mahlzeit';
      default: return `Zu ${this.selectedMealLabel()}`;
    }
  }

  private ensureAddOpen(): void {
    if (!this.isModalOpen()) this.openAdd();
  }

  // --- Formular ---
  get quantityUnit(): QuantityUnit | null {
    return this.scaleBase?.unit ?? null;
  }

  /** Basiseinheit der Quelle (Hinweis „kcal pro 100 g/ml“). */
  get baseUnit(): 'g' | 'ml' {
    return baseUnitOf(this.amountUnit);
  }

  /** Eingegebene Menge in Basiseinheit (g bzw. ml); null bei leerer/ungültiger Eingabe. */
  private get baseAmount(): number | null {
    const v = this.form.amountG;
    return v == null ? null : toBaseAmount(v, this.amountUnit);
  }

  /** Wechselt die Einheit und rechnet den gezeigten Wert um (Menge bleibt gleich). */
  setAmountUnit(unit: unknown): void {
    if (!AMOUNT_UNITS.includes(unit as AmountUnit) || unit === this.amountUnit) return;
    const next = unit as AmountUnit;
    // Ungerundet umrechnen, damit g -> kg -> g keine Kleinstmengen verliert.
    const v = this.form.amountG;
    this.form = { ...this.form, amountG: v == null ? null : convertAmount(v, this.amountUnit, next) };
    this.amountUnit = next;
    this.unitTouched = true;
  }

  /** Name geändert: bei manueller Eingabe die Einheit vorschlagen, solange nicht manuell gewählt. */
  setLabel(value: unknown): void {
    const label = typeof value === 'string' ? value : '';
    this.form = { ...this.form, label };
    if (!this.scaleBase && !this.unitTouched) this.amountUnit = unitForName(label);
  }

  /** True, wenn das gewählte Rezept Zutaten ohne Nährwerte hat. */
  isPartialRecipe(): boolean {
    return this.isPartialSource;
  }

  /** Einheit des Eintrags im Bearbeiten-Dialog. */
  get editEntryUnit(): AmountUnit {
    return this.editUnit;
  }

  /** Bearbeiten-Dialog: Einheit wechseln, gezeigten Wert umrechnen. */
  setEditUnit(unit: unknown): void {
    if (!AMOUNT_UNITS.includes(unit as AmountUnit) || unit === this.editUnit) return;
    const next = unit as AmountUnit;
    const v = this.editForm.amountG;
    this.editForm = { ...this.editForm, amountG: v == null ? null : convertAmount(v, this.editUnit, next) };
    this.editUnit = next;
  }

  /** kcal pro 100 g der gewählten Quelle (Hinweis unter der Mengeneingabe). */
  get basisKcal(): number | null {
    return this.scaleBase?.unit === 'g' ? this.scaleBase.facts.kcal : null;
  }

  /** Blendet das Formular für eine manuelle Eingabe ein; kcal sind Pflicht, daher offen. */
  openManualEntry(): void {
    this.scaleBase = null;
    this.pickedRecipeId = null;
    const label = this.searchQuery.trim();
    this.form = { ...this.form, ...EMPTY_FIELDS, label, amountG: null, servings: null };
    this.clearRawTexts(ADD_FORM_TEXT_KEYS);
    this.amountUnit = unitForName(label);
    this.unitTouched = false;
    this.formHint.set(null);
    this.isAiEstimate.set(false);
    this.isPartialSource = false;
    this.error.set(null);
    this.adjustOpen.set('adjust');
    this.view.set('form');
  }

  /** Anzeigetext eines Zahlenfelds (Dezimalkomma, Tipptext bleibt erhalten). */
  numText(key: string, value: number | null): string {
    return inputTextFor(this.rawTexts[key], value);
  }

  /** Markiert beim Fokus den gesamten Feldinhalt, damit Tippen ihn ersetzt. */
  selectAllOnFocus(event: Event): void {
    const el = event.target as { getInputElement?: () => Promise<HTMLInputElement> } | null;
    void el?.getInputElement?.().then((input) => input.select());
  }

  /** Nährwert-Feld (kcal/Eiweiß/...) aus Texteingabe setzen. */
  setField(key: keyof EntryFields, value: unknown): void {
    this.rawTexts[key] = String(value ?? '');
    this.form = { ...this.form, [key]: toNumberOrNull(value) };
  }

  setFastFoodField(key: 'kcalBudget' | 'moneyBudget', value: unknown): void {
    this.rawTexts['ff.' + key] = String(value ?? '');
    this.ff = { ...this.ff, [key]: toNumberOrNull(value) };
  }

  setEditAmount(value: unknown): void {
    this.rawTexts['editAmount'] = String(value ?? '');
    this.editForm = { ...this.editForm, amountG: toNumberOrNull(value) };
  }

  /** Schnellwahl-Mengen in der aktuellen Einheit des Formulars. */
  get quickAmountOptions(): readonly number[] {
    return quickAmounts(this.amountUnit);
  }

  get editQuickAmountOptions(): readonly number[] {
    return quickAmounts(this.editUnit);
  }

  /**
   * Letzte geloggte Menge (in aktueller Einheit) für das gewählte Lebensmittel, sonst null.
   * `excludeId`: der gerade bearbeitete Eintrag zählt nicht als „zuletzt“.
   */
  lastAmountFor(label: string, unit: AmountUnit, excludeId?: string | null): number | null {
    const amount = lastAmountForLabel(this.diary.entries(), label, excludeId);
    return amount == null ? null : fromBaseAmount(amount, unit);
  }

  /** ID des Eintrags im Bearbeiten-Dialog (für „wie zuletzt“). */
  get editEntryId(): string | null {
    return this.editEntry?.id ?? null;
  }

  pickAmount(value: number): void {
    delete this.rawTexts['amount'];
    this.setAmount(value);
  }

  pickEditAmount(value: number): void {
    delete this.rawTexts['editAmount'];
    this.setEditAmount(value);
  }

  setAmount(value: unknown): void {
    if (typeof value === 'string') this.rawTexts['amount'] = value;
    this.form = { ...this.form, amountG: toNumberOrNull(value) };
    this.rescale();
  }

  setServings(value: unknown): void {
    if (typeof value === 'string') this.rawTexts['servings'] = value;
    this.form = { ...this.form, servings: toNumberOrNull(value) };
    this.rescale();
  }

  setAdjustOpen(value: unknown): void {
    this.adjustOpen.set(typeof value === 'string' ? value : undefined);
  }

  /** Rechnet die Nährwert-Felder aus den Bezugswerten und der aktuellen Menge neu. */
  private rescale(): void {
    const base = this.scaleBase;
    if (!base) return;
    const factor = base.unit === 'g' ? (this.baseAmount ?? 0) / 100 : (this.form.servings ?? 0);
    if (factor <= 0) return;
    this.form = { ...this.form, ...fieldsFromFacts(scaleFacts(base.facts, factor)) };
  }

  /** Schreibt Name + Nährwerte ins Formular und wechselt zur Mengen-Ansicht. */
  private applyFacts(name: string, facts: NutritionFacts, opts: ApplyOptions = {}): void {
    this.ensureAddOpen();
    const unit: QuantityUnit = facts.basis === 'per100g' ? 'g' : 'portion';
    const baseAmount = unit === 'g' ? (opts.amountG ?? DEFAULT_AMOUNT_G) : null;
    const shownUnit = opts.unit ?? unitForName(name);
    const amountG = baseAmount == null ? null : fromBaseAmount(baseAmount, shownUnit);
    const servings = unit === 'portion' ? (opts.servings ?? 1) : null;
    const factor = unit === 'g' ? (baseAmount ?? 0) / 100 : (servings ?? 0);

    this.scaleBase = { facts, unit };
    this.clearRawTexts(ADD_FORM_TEXT_KEYS);
    this.amountUnit = shownUnit;
    this.unitTouched = false;
    this.pickedRecipeId = opts.recipeId ?? null;
    this.form = {
      ...this.form,
      ...fieldsFromFacts(scaleFacts(facts, factor)),
      label: name,
      amountG,
      servings,
    };
    this.formHint.set(opts.hint ?? null);
    this.isAiEstimate.set(opts.isAi ?? false);
    this.isPartialSource = opts.isPartial ?? false;
    this.error.set(null);
    this.adjustOpen.set(undefined);
    this.view.set('form');
    setTimeout(() => this.focusAmount(), AMOUNT_FOCUS_DELAY_MS);
  }

  /** Fokussiert das Mengenfeld und markiert den Inhalt, damit Tippen ihn ersetzt. */
  private focusAmount(): void {
    const input = this.amountInput;
    if (!input) return;
    void input.setFocus().then(() => input.getInputElement()).then((el) => el.select());
  }

  // --- Suche ---
  onSearchInput(value: unknown): void {
    this.searchQuery = typeof value === 'string' ? value : '';
    if (this.searchQuery.trim().length === 0) {
      this.searchSeq += 1;
      this.searchResults.set([]);
      this.searchHint.set(null);
      this.searching.set(false);
      return;
    }
    void this.searchFood();
  }

  async searchFood(): Promise<void> {
    const q = this.searchQuery.trim();
    if (!q) return;
    const seq = ++this.searchSeq;
    this.error.set(null);
    this.searchHint.set(null);
    this.searching.set(true);
    try {
      const results = await this.food.searchByText(q);
      if (seq !== this.searchSeq) return;
      this.searchResults.set(results);
      if (results.length === 0) {
        this.searchHint.set(`Keine Treffer für „${q}“ — prüfe die Schreibweise oder trage es manuell ein.`);
      }
    } catch (e: unknown) {
      if (seq === this.searchSeq) this.error.set(foodErrorMessage(e));
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  /** Übernimmt einen Suchtreffer (Nährwerte pro 100 g) ins Formular. */
  selectFood(item: FoodItem): void {
    this.applyFacts(item.name, item.facts);
    this.searchResults.set([]);
    this.searchQuery = '';
  }

  /** Übernimmt ein Rezept (Nährwerte je Portion) ins Formular; Menge = Portionen. */
  selectRecipe(recipe: Recipe): void {
    if (!recipe.factsPerServing) return;
    this.applyFacts(recipe.title, recipe.factsPerServing, {
      recipeId: recipe.id,
      isPartial: countMissingFacts(recipe.ingredients) > 0,
    });
  }

  /** Übernimmt ein gespeichertes eigenes Lebensmittel ins Formular. */
  selectCustomFood(food: CustomFood): void {
    this.applyFacts(food.name, food.facts);
  }

  /** Öffnet einen zuletzt benutzten Eintrag zum Anpassen (statt ihn direkt zu loggen). */
  editRecent(entry: DiaryEntry): void {
    const base = entry.baseFacts?.basis === 'per100g' ? entry.baseFacts : null;
    if (base) {
      this.applyFacts(entry.label, base, { amountG: entry.amountG ?? DEFAULT_AMOUNT_G, unit: entry.unit });
      return;
    }
    // entry.facts gelten für alle Portionen -> auf eine Portion zurückrechnen.
    this.applyFacts(entry.label, perServingFacts(entry.facts, entry.servings), {
      servings: entry.servings,
      recipeId: entry.ref?.kind === 'recipe' ? entry.ref.recipeId : undefined,
      isPartial: entry.isPartial,
    });
  }

  // --- Schnell-Loggen (ein Tipp) ---
  /** Loggt einen zuletzt benutzten Eintrag sofort mit seiner letzten Menge. */
  quickAddRecent(entry: DiaryEntry): void {
    this.addAndConfirm([
      {
        dateISO: this.selectedDate(),
        meal: this.form.meal,
        label: entry.label,
        ref: entry.ref,
        amountG: entry.amountG,
        servings: entry.servings,
        facts: entry.facts,
        baseFacts: entry.baseFacts,
        isEstimate: entry.isEstimate,
        isPartial: entry.isPartial,
        unit: entry.unit,
      },
    ]);
  }

  /** Loggt eine Portion eines Rezepts sofort. */
  quickAddRecipe(recipe: Recipe): void {
    if (!recipe.factsPerServing) return;
    this.addAndConfirm([
      {
        dateISO: this.selectedDate(),
        meal: this.form.meal,
        label: recipe.title,
        ref: { kind: 'recipe', recipeId: recipe.id },
        servings: 1,
        facts: recipe.factsPerServing,
        isPartial: countMissingFacts(recipe.ingredients) > 0,
      },
    ]);
  }

  /** Loggt alle Einträge einer gespeicherten Mahlzeit sofort in die gewählte Mahlzeit. */
  quickAddSavedMeal(meal: SavedMeal): void {
    this.addAndConfirm(
      meal.entries.map((e) => ({
        dateISO: this.selectedDate(),
        meal: this.form.meal,
        label: e.label,
        ref: e.ref,
        amountG: e.amountG,
        servings: e.servings,
        facts: e.facts,
      })),
    );
  }

  mealKcal(meal: SavedMeal): number {
    return this.mealsStore.totalKcal(meal);
  }

  private addAndConfirm(inputs: NewDiaryEntry[], verb = 'Hinzugefügt'): void {
    const added = inputs.map((input) => this.diary.add(input));
    this.closeAdd();
    const kcal = added.reduce((sum, e) => sum + (e.facts.kcal || 0), 0);
    void this.showToast(`${verb} · ${formatNum(kcal, 0)} kcal`, () =>
      added.forEach((e) => this.diary.remove(e.id)),
    );
  }

  // --- Etikett-Scan (KI) ---
  /** Native Kamera, sonst Datei-Dialog. */
  startLabelScan(fileInput: HTMLInputElement): void {
    if (this.nativeCamera) {
      void this.takeLabelPhoto();
      return;
    }
    fileInput.click();
  }

  /** Nimmt per nativer Kamera ein Etiketten-Foto auf und erkennt es per KI. */
  async takeLabelPhoto(): Promise<void> {
    this.error.set(null);
    this.scanning.set(true);
    try {
      const base64 = await this.camera.takePhotoBase64();
      await this.recognizeLabel(base64);
    } catch (e: unknown) {
      this.reportScanError(e instanceof Error ? e.message : 'Kamera nicht verfügbar — nutze die Suche oder trage manuell ein.');
    } finally {
      this.scanning.set(false);
    }
  }

  /** Liest ein Etiketten-Foto (Datei-Upload-Fallback) per KI-Vision. */
  async onLabelFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.error.set(null);
    this.scanning.set(true);
    try {
      const base64 = await this.fileToBase64(file);
      await this.recognizeLabel(base64);
    } catch (e: unknown) {
      this.reportScanError(e instanceof Error ? e.message : 'Das Etikett konnte nicht gelesen werden — mach ein schärferes Foto oder trage manuell ein.');
    } finally {
      this.scanning.set(false);
      input.value = '';
    }
  }

  private reportScanError(message: string): void {
    this.ensureAddOpen();
    this.error.set(message);
  }

  /** Ruft die KI-Etiketterkennung und schreibt das Ergebnis ins Formular. */
  private async recognizeLabel(base64: string): Promise<void> {
    const res = await this.ai.recognizeLabel(base64, 'per100g');
    this.applyFacts(res.name, res.facts, {
      isAi: true,
      hint: 'Werte pro 100 g erkannt — bitte mit dem Etikett vergleichen.',
    });
  }

  // --- Barcode scanner ---
  openBarcode(): void {
    this.manualBarcode = '';
    this.bcError.set(null);
    this.bcLooking.set(false);
    this.bcManualOpen.set(false);
    this.bcOpen.set(true);
  }

  closeBarcode(): void {
    this.bcOpen.set(false);
  }

  toggleBcManual(): void {
    this.bcManualOpen.update((v) => !v);
  }

  /** ion-modal didPresent → Live-Scan starten, sofern der Browser es kann. */
  async onBarcodePresent(): Promise<void> {
    const video =
      this.barcodeVideo?.nativeElement ??
      (document.querySelector('video#barcodeVideo') as HTMLVideoElement | null);
    if (!video || !this.barcode.isSupported()) return;
    try {
      this.scanControls = await this.barcode.start(
        video,
        (code) => this.lookupBarcode(code),
        () => this.bcError.set('Kamerazugriff fehlgeschlagen — gib den Code manuell ein.'),
      );
    } catch {
      this.bcError.set('Kamera nicht verfügbar — gib den Code manuell ein.');
    }
  }

  /** ion-modal didDismiss → Kamera/Scanner freigeben. */
  onBarcodeDismiss(): void {
    this.stopScanner();
  }

  private stopScanner(): void {
    this.scanControls?.stop();
    this.scanControls = undefined;
  }

  submitManualBarcode(): void {
    const code = this.manualBarcode.trim();
    if (code) this.lookupBarcode(code);
  }

  /** Schlägt einen Barcode nach und übernimmt den Treffer ins Formular. */
  private async lookupBarcode(code: string): Promise<void> {
    if (this.bcLooking()) return;
    this.stopScanner();
    this.bcError.set(null);
    this.bcLooking.set(true);
    try {
      const item = await this.food.lookupByBarcode(code);
      if (!item) {
        this.bcError.set(`Kein Produkt zu Barcode ${code} gefunden — prüfe die Ziffern oder suche per Name.`);
        return;
      }
      this.applyFacts(item.name, item.facts);
      this.closeBarcode();
      // Realen Preis (Open Prices) best-effort ergänzen — blockiert nichts.
      const price = await this.prices.priceByBarcode(code);
      if (price) {
        this.formHint.set(`Realer Preis ca. ${formatNum(price.avg, 2, 2)} ${price.currency}.`);
      }
    } catch (e: unknown) {
      this.bcError.set(foodErrorMessage(e));
    } finally {
      this.bcLooking.set(false);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden — wähle sie erneut aus.'));
      reader.readAsDataURL(file);
    });
  }

  // --- Speichern ---
  save(): void {
    const label = this.form.label.trim();
    if (!label) {
      this.error.set('Der Name fehlt — gib ein, was du gegessen hast.');
      return;
    }
    const base = this.scaleBase;
    if (base?.unit === 'g' && !isValidAmount(this.baseAmount)) {
      this.error.set('Die Menge fehlt — gib eine Menge größer als 0 ein.');
      return;
    }
    if (base?.unit === 'portion' && !isValidAmount(this.form.servings)) {
      this.error.set('Die Portionen fehlen — gib eine Zahl größer als 0 ein.');
      return;
    }
    if (!base && this.form.amountG != null && !isValidAmount(this.baseAmount)) {
      this.error.set('Die Menge muss größer als 0 sein — oder lass das Feld leer.');
      return;
    }
    const facts = factsFromFields(this.form);
    if (!facts) {
      this.error.set('Die Kalorien fehlen — trage sie unter „Nährwerte anpassen“ ein.');
      this.adjustOpen.set('adjust');
      return;
    }

    const isPortion = base?.unit === 'portion';
    const recipeId = this.pickedRecipeId;
    const entry = this.diary.add({
      dateISO: this.selectedDate(),
      meal: this.form.meal,
      label,
      ref: recipeId ? { kind: 'recipe', recipeId } : undefined,
      servings: isPortion ? (this.form.servings ?? 1) : undefined,
      amountG: this.baseAmount ?? undefined,
      facts,
      baseFacts: this.baseForSave(base, facts),
      isEstimate: this.isAiEstimate() || undefined,
      isPartial: this.isPartialSource || undefined,
      unit: this.baseAmount ? this.amountUnit : undefined,
    });
    if (!recipeId && base?.unit !== 'g') this.customFoods.save(label, facts);

    this.closeAdd();
    void this.showToast(`Gespeichert · ${formatNum(facts.kcal, 0)} kcal`, () => this.diary.remove(entry.id));
  }

  /** Bezugswerte für spätere Mengenänderung; bei manuell angepassten Werten daraus neu abgeleitet. */
  private baseForSave(base: ScaleBase | null, facts: NutritionFacts): NutritionFacts | undefined {
    if (base?.unit !== 'g') return undefined;
    const amount = this.baseAmount;
    if (!isValidAmount(amount)) return base.facts;
    const scaled = scaleFacts(base.facts, amount / 100);
    return factsDiffer(scaled, facts) ? rebaseTo100(facts, amount) : base.facts;
  }

  // --- Eintrag bearbeiten / löschen ---
  openEdit(entry: DiaryEntry): void {
    this.editEntry = entry;
    this.clearRawTexts(EDIT_FORM_TEXT_KEYS);
    this.editUnit = entry.unit ?? 'g';
    // Manuelle Einträge mit Menge bekommen eine abgeleitete Basis, damit die Menge änderbar ist.
    this.editBaseFacts = editBaseFor(entry);
    this.editForm = {
      label: entry.label,
      meal: entry.meal,
      amountG: entry.amountG == null ? null : fromBaseAmount(entry.amountG, this.editUnit),
    };
    this.editError = null;
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editEntry = null;
  }

  saveEdit(): void {
    if (!this.editEntry) return;
    const editBase = this.editForm.amountG == null ? null : toBaseAmount(this.editForm.amountG, this.editUnit);
    if (this.editBaseFacts && !isValidAmount(editBase)) {
      this.editError = 'Die Menge fehlt — gib eine Menge größer als 0 ein.';
      return;
    }
    const patch: Parameters<typeof this.diary.update>[1] = {
      label: this.editForm.label.trim() || undefined,
      meal: this.editForm.meal,
    };
    if (this.editBaseFacts && isValidAmount(editBase)) {
      patch.amountG = editBase;
      patch.unit = this.editUnit;
      // Abgeleitete Basis nur bei geänderter Menge übernehmen (sonst keine Rundungsdrift).
      const isDerivedBase = !this.editEntry.baseFacts;
      if (isDerivedBase && editBase !== this.editEntry.amountG) patch.baseFacts = this.editBaseFacts;
    }
    this.diary.update(this.editEntry.id, patch);
    this.closeEdit();
  }

  deleteFromEdit(): void {
    const entry = this.editEntry;
    this.closeEdit();
    if (entry) this.remove(entry);
  }

  /** Löscht einen Eintrag; „Rückgängig“ legt ihn (am Ende der Mahlzeit) neu an. */
  remove(entry: DiaryEntry): void {
    this.diary.remove(entry.id);
    void this.showToast(`„${entry.label}“ gelöscht`, () => {
      this.diary.add({
        dateISO: entry.dateISO,
        meal: entry.meal,
        label: entry.label,
        ref: entry.ref,
        amountG: entry.amountG,
        servings: entry.servings,
        facts: entry.facts,
        baseFacts: entry.baseFacts,
        isEstimate: entry.isEstimate,
        isPartial: entry.isPartial,
        unit: entry.unit,
      });
    });
  }

  // --- Wie gestern / Tag kopieren ---
  readonly copyFromButtonText = copyFromButtonText;

  /** Übernimmt eine leere Mahlzeit vom letzten Tag, an dem sie Einträge hatte. */
  copyMeal(group: MealGroup): void {
    if (!group.copySource) return;
    const copies = this.diary.copyEntries(group.copySource.entries, this.selectedDate());
    this.confirmCopy(copies, `${group.label} ${copyFromText(group.copySource.dateISO)}`);
  }

  /** Fragt den Quelltag ab (letzte 7 Tage) und kopiert ihn nach Bestätigung in den gezeigten Tag. */
  async copyDay(): Promise<void> {
    const sources = this.daySources();
    if (sources.length === 0) return;
    const sourceDate = await this.askCopyDay(sources);
    const source = sources.find((s) => s.dateISO === sourceDate);
    if (!source) return;
    const copies = this.diary.copyEntries(source.entries, this.selectedDate());
    this.confirmCopy(copies, `Tag ${copyFromText(source.dateISO)}`);
  }

  private async askCopyDay(sources: CopySource[]): Promise<string | null> {
    const hasEntries = this.groups().some((g) => g.entries.length > 0);
    const keepNote = hasEntries ? ' Vorhandene Einträge bleiben erhalten.' : '';
    const alert = await this.alertCtrl.create({
      header: 'Tag kopieren',
      message: `Alle Einträge des gewählten Tages werden zu „${this.dateLabel()}“ hinzugefügt.${keepNote}`,
      inputs: sources.map((s, i) => ({
        type: 'radio' as const,
        label: copySourceOptionText(s),
        value: s.dateISO,
        checked: i === 0,
      })),
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Kopieren', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: string }>();
    return role === 'confirm' ? (data?.values ?? null) : null;
  }

  private confirmCopy(copies: DiaryEntry[], what: string): void {
    if (copies.length === 0) return;
    const kcal = formatNum(entriesKcal(copies), 0);
    void this.showToast(`${what} übernommen · ${entryCountText(copies.length)} · ${kcal} kcal`, () =>
      this.diary.removeMany(copies.map((c) => c.id)),
    );
  }

  // --- Fastfood-Helfer ---
  openFastfood(): void {
    this.ffResults.set([]);
    this.ffSearched.set(false);
    this.error.set(null);
    // Auch bei verbrauchtem Budget setzen (0 = nichts mehr übrig).
    if (this.targetKcal() > 0) {
      this.ff = { ...this.ff, kcalBudget: this.remainingKcal() };
    }
    this.ffOpen.set(true);
  }

  closeFastfood(): void {
    this.ffOpen.set(false);
  }

  async runFastfood(): Promise<void> {
    this.error.set(null);
    this.ffLoading.set(true);
    try {
      this.ffResults.set(
        await this.ai.suggestFastfood({
          restaurant: this.ff.restaurant.trim() || 'Fastfood',
          kcalBudget: this.ff.kcalBudget ?? 0,
          moneyBudget: this.ff.moneyBudget ?? undefined,
          preference: this.ff.preference,
        }),
      );
      this.ffSearched.set(true);
    } catch (e: unknown) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Die Vorschläge konnten nicht geladen werden — prüfe deine Verbindung und versuche es erneut.',
      );
    } finally {
      this.ffLoading.set(false);
    }
  }

  logFastfood(s: FastFoodSuggestion): void {
    const entry = this.diary.add({
      dateISO: this.selectedDate(),
      meal: this.currentMeal(),
      label: `${s.itemName} (${s.restaurant})`,
      facts: s.facts,
      isEstimate: true,
    });
    this.closeFastfood();
    void this.showToast(`Hinzugefügt · ${formatNum(s.facts.kcal, 0)} kcal`, () => this.diary.remove(entry.id));
  }

  // --- Feedback ---
  private async showToast(message: string, onUndo?: () => void): Promise<void> {
    const open = await this.toastCtrl.getTop();
    await open?.dismiss();
    const toast = await this.toastCtrl.create({
      message,
      duration: onUndo ? TOAST_UNDO_MS : TOAST_MS,
      position: 'bottom',
      buttons: onUndo ? [{ text: 'Rückgängig', handler: () => onUndo() }] : [],
    });
    await toast.present();
  }
}
