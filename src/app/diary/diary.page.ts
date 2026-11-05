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
import { ToastController } from '@ionic/angular';
import type { IScannerControls } from '@zxing/browser';
import { DiaryEntry, FastFoodSuggestion, FoodItem, MealType, NutritionFacts, Recipe, SavedMeal } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { FOOD_PROVIDER } from '../core/food/food-provider';
import { foodErrorMessage } from '../core/food/food-errors';
import { CameraService } from '../core/scan/camera.service';
import { BarcodeScannerService } from '../core/scan/barcode-scanner.service';
import { OpenPricesProvider } from '../core/price/open-prices.provider';
import { DiaryStore, NewDiaryEntry } from '../core/state/diary.store';
import { MealsStore } from '../core/state/meals.store';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { CustomFood, CustomFoodStore } from '../core/state/custom-food.store';
import { addDaysISO, dayLabel, toDateISO } from '../core/util/date';
import { formatNum } from '../shared/num.pipe';
import {
  EMPTY_FIELDS,
  EntryFields,
  MEAL_DEFS,
  factsFromFields,
  fieldsFromFacts,
  isIsoDate,
  isMealType,
  mealForHour,
  mealLabel,
  scaleFacts,
  toNumberOrNull,
} from './diary-helpers';

interface MealGroup {
  type: MealType;
  label: string;
  icon: string;
  entries: DiaryEntry[];
  kcal: number;
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
  servings?: number;
  recipeId?: string;
  isAi?: boolean;
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
const TOAST_MS = 2500;
const TOAST_UNDO_MS = 5000;

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

  @ViewChild('barcodeVideo') barcodeVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('searchbar') searchbar?: { setFocus(): Promise<void> };

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
      return { ...d, entries, kcal: Math.round(kcal) };
    });
  });

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
  form: EntryForm = { ...EMPTY_FORM };

  /** Gewähltes Rezept (für die ref des Eintrags), null bei manuell/Food. */
  private pickedRecipeId: string | null = null;
  /** Bezugswerte für die Mengenskalierung; null bei manueller Eingabe. */
  scaleBase: ScaleBase | null = null;

  // --- Edit-Modal ---
  readonly editOpen = signal(false);
  private editEntry: DiaryEntry | null = null;
  editForm: { label: string; meal: MealType; amountG: number | null } = {
    label: '', meal: 'breakfast', amountG: null,
  };
  editBaseFacts: NutritionFacts | null = null;

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
    if (!add && !wantsFastfood) return;

    const date = params.get('date');
    if (add) {
      this.selectedDate.set(isIsoDate(date) ? date : toDateISO());
      this.openAdd(isMealType(add) ? add : this.currentMeal());
    }
    if (wantsFastfood) this.openFastfood();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { add: null, fastfood: null, date: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
    this.pickedRecipeId = null;
    this.scaleBase = null;
    this.recipeQuery.set('');
    this.customQuery.set('');
    this.searchQuery = '';
    this.searchResults.set([]);
    this.searchHint.set(null);
    this.formHint.set(null);
    this.isAiEstimate.set(false);
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

  /** kcal pro 100 g der gewählten Quelle (Hinweis unter der Mengeneingabe). */
  get basisKcal(): number | null {
    return this.scaleBase?.unit === 'g' ? this.scaleBase.facts.kcal : null;
  }

  /** Blendet das Formular für eine manuelle Eingabe ein; kcal sind Pflicht, daher offen. */
  openManualEntry(): void {
    this.scaleBase = null;
    this.pickedRecipeId = null;
    this.form = { ...this.form, ...EMPTY_FIELDS, label: this.searchQuery.trim(), amountG: null, servings: null };
    this.formHint.set(null);
    this.isAiEstimate.set(false);
    this.error.set(null);
    this.adjustOpen.set('adjust');
    this.view.set('form');
  }

  setAmount(value: unknown): void {
    this.form = { ...this.form, amountG: toNumberOrNull(value) };
    this.rescale();
  }

  setServings(value: unknown): void {
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
    const factor = base.unit === 'g' ? (this.form.amountG ?? 0) / 100 : (this.form.servings ?? 0);
    if (factor <= 0) return;
    this.form = { ...this.form, ...fieldsFromFacts(scaleFacts(base.facts, factor)) };
  }

  /** Schreibt Name + Nährwerte ins Formular und wechselt zur Mengen-Ansicht. */
  private applyFacts(name: string, facts: NutritionFacts, opts: ApplyOptions = {}): void {
    this.ensureAddOpen();
    const unit: QuantityUnit = facts.basis === 'per100g' ? 'g' : 'portion';
    const amountG = unit === 'g' ? (opts.amountG ?? DEFAULT_AMOUNT_G) : null;
    const servings = unit === 'portion' ? (opts.servings ?? 1) : null;
    const factor = unit === 'g' ? (amountG ?? 0) / 100 : (servings ?? 0);

    this.scaleBase = { facts, unit };
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
    this.error.set(null);
    this.adjustOpen.set(undefined);
    this.view.set('form');
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
    this.applyFacts(recipe.title, recipe.factsPerServing, { recipeId: recipe.id });
  }

  /** Übernimmt ein gespeichertes eigenes Lebensmittel ins Formular. */
  selectCustomFood(food: CustomFood): void {
    this.applyFacts(food.name, food.facts);
  }

  /** Öffnet einen zuletzt benutzten Eintrag zum Anpassen (statt ihn direkt zu loggen). */
  editRecent(entry: DiaryEntry): void {
    const base = entry.baseFacts?.basis === 'per100g' ? entry.baseFacts : null;
    if (base) {
      this.applyFacts(entry.label, base, { amountG: entry.amountG ?? DEFAULT_AMOUNT_G });
      return;
    }
    this.applyFacts(entry.label, entry.facts);
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
    const facts = factsFromFields(this.form);
    if (!facts) {
      this.error.set('Die Kalorien fehlen — trage sie unter „Nährwerte anpassen“ ein.');
      this.adjustOpen.set('adjust');
      return;
    }

    const base = this.scaleBase;
    const isPortion = base?.unit === 'portion';
    const recipeId = this.pickedRecipeId;
    const entry = this.diary.add({
      dateISO: this.selectedDate(),
      meal: this.form.meal,
      label,
      ref: recipeId ? { kind: 'recipe', recipeId } : undefined,
      servings: isPortion ? (this.form.servings ?? 1) : undefined,
      amountG: this.form.amountG ?? undefined,
      facts,
      baseFacts: base?.unit === 'g' ? base.facts : undefined,
    });
    if (!recipeId && base?.unit !== 'g') this.customFoods.save(label, facts);

    this.closeAdd();
    void this.showToast(`Gespeichert · ${formatNum(facts.kcal, 0)} kcal`, () => this.diary.remove(entry.id));
  }

  // --- Eintrag bearbeiten / löschen ---
  openEdit(entry: DiaryEntry): void {
    this.editEntry = entry;
    this.editBaseFacts = entry.baseFacts ?? null;
    this.editForm = {
      label: entry.label,
      meal: entry.meal,
      amountG: entry.amountG ?? null,
    };
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editEntry = null;
  }

  saveEdit(): void {
    if (!this.editEntry) return;
    const patch: Parameters<typeof this.diary.update>[1] = {
      label: this.editForm.label.trim() || undefined,
      meal: this.editForm.meal,
    };
    if (this.editBaseFacts && this.editForm.amountG != null) {
      patch.amountG = this.editForm.amountG;
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
      });
    });
  }

  // --- Fastfood-Helfer ---
  openFastfood(): void {
    this.ffResults.set([]);
    this.error.set(null);
    if (this.remainingKcal() > 0) {
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
