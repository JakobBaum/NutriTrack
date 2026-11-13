import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { UNIT_OPTIONS } from '../core/util/units';
import { clearQueryParams, pickParam } from '../core/navigation/query-params';
import { formatDecimal, parseDecimal } from '../core/util/number-input';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/lazy';
import { OnlineSearchComponent } from './online-search/online-search.component';
import { hasIncompleteFacts } from '../core/nutrition/units-weight';
import { importBlockReason, importErrorMessage } from './recipe-view';
import {
  FactKey,
  IngredientForm,
  RecipeForm,
  applyFact,
  buildRecipeDraft,
  cookedWeightIsEstimate,
  cookedWeightValue,
  emptyForm,
  formFromImport,
  formFromRecipe,
  nextCookedWeight,
  positiveOrZero,
  recipeDiaryEntry,
  toRecipeIngredients,
} from './recipe-form';
import { askPortionsSheet, cardMenuSheet, mealLabel, pickMealSheet } from './recipe-sheets';
import { TOAST_SWIPE_GESTURE } from '../shared/toast-options';
import { confirmDiscard } from '../meals/confirm-discard';
import { MealType, NutritionFacts, Recipe, RecipeIngredient } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { FoodSourceResult } from '../shared/food-sources/food-sources.component';
import { CameraService } from '../core/scan/camera.service';
import { DiaryStore } from '../core/state/diary.store';
import { RecipeStore } from '../core/state/recipe.store';
import {
  perServingFacts,
  totalFacts,
  hasNutrition,
  ingredientFacts,
} from '../core/nutrition/recipe-nutrition';
import { toDateISO } from '../core/util/date';
import { MealsListComponent } from '../meals/meals-list.component';
import { UNDO_TOAST_BUTTONS, UNDO_TOAST_MS, UndoableDelete, settleUndoToast } from '../meals/undoable-delete';
import { shrinkPhotoForUpload } from '../core/scan/label-image';
import {
  APPROX_UNITS,
  isUnknownUnit,
  isValidYield,
  lowerBoundNote,
  optionalGramsLabel,
  countMissingFacts,
  hasApproxUnits,
  isAiOrigin,
  lowerBoundPrefix,
  missingFactsLabel,
  servingsLabel,
  totalWeightG,
  recipeDisplayFacts,
  recipeMetaLine,
} from './recipe-view';

type RecipesView = 'recipes' | 'meals';
const RECIPES_VIEWS: readonly RecipesView[] = ['recipes', 'meals'];

/**
 * Rezepte: Liste eigener Rezepte, anlegen/bearbeiten, löschen und ins Tagebuch
 * loggen. Zutaten werden per Food-API (Textsuche + Barcode) befüllt; die
 * Nährwerte werden pro Zutat skaliert und zum Gesamt/je Portion summiert.
 */
@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.page.html',
  styleUrls: ['./recipes.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipesPage implements OnDestroy {
  private readonly store = inject(RecipeStore);
  private readonly diary = inject(DiaryStore);
  private readonly camera = inject(CameraService);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly ai = inject(AiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);

  /** Segment „Rezepte | Mahlzeiten“; per `?view=meals` vorwählbar (alte Route /meals). */
  readonly view = signal<RecipesView>('recipes');
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly mealsList = viewChild(MealsListComponent);

  private readonly deletion = new UndoableDelete((id) => this.store.remove(id));
  readonly undoOpen = signal(false);
  readonly undoDuration = UNDO_TOAST_MS;
  readonly toastSwipe = TOAST_SWIPE_GESTURE;
  readonly undoButtons = UNDO_TOAST_BUTTONS;

  readonly nativeCamera = this.camera.isNativeCameraAvailable();
  readonly importPhotoScanning = signal(false);

  // --- Rezept-Import (Text/URL via KI) ---
  readonly importOpen = signal(false);
  readonly importBusy = signal(false);
  readonly importError = signal<string | null>(null);
  importText = '';
  importUrl = '';

  isLive(): boolean {
    return this.ai.isLive();
  }

  /** Grund, warum „Importieren“ gerade gesperrt ist (leer = bereit). */
  importBlocked(): string {
    return importBlockReason(this.importText, this.isLive() ? this.importUrl : '');
  }

  /** Verlässt den Import Richtung Profil (KI-Status). */
  openAiSettings(): void {
    this.importOpen.set(false);
    void this.router.navigate(['/settings']);
  }

  /** Rezepte ohne das gerade zum Löschen vorgemerkte. */
  readonly recipes = computed(() => this.store.recipes().filter((r) => r.id !== this.deletion.pendingId()));
  readonly approxUnits = APPROX_UNITS;
  readonly isAiOrigin = isAiOrigin;
  readonly countMissingFacts = countMissingFacts;
  readonly missingFactsLabel = missingFactsLabel;
  readonly lowerBoundPrefix = lowerBoundPrefix;
  readonly lowerBoundNote = lowerBoundNote;
  readonly optionalGramsLabel = optionalGramsLabel;
  readonly servingsLabel = servingsLabel;
  readonly recipeFacts = recipeDisplayFacts;

  /** Meta-Zeile „2 Portionen · 1 Zutat · 4 kcal gesamt“. */
  metaLine(recipe: Recipe): string {
    return recipeMetaLine(recipe, recipeDisplayFacts(recipe)?.kcal);
  }

  readonly unitOptions = UNIT_OPTIONS;

  /** True, wenn die Einheit (z. B. aus dem Import) nicht in der Auswahl steht. */
  isUnknownUnit(unit: string): boolean {
    return isUnknownUnit(unit, this.unitOptions);
  }

  setUnit(ing: IngredientForm, unit: string): void {
    ing.unit = unit;
  }

  private readonly rawAmounts = new WeakMap<IngredientForm, string>();

  /** Anzeigetext der Menge: Roh-Eingabe behalten, solange sie zum Wert passt ("2," bleibt stehen). */
  amountText(ing: IngredientForm): string {
    const raw = this.rawAmounts.get(ing);
    return raw !== undefined && parseDecimal(raw) === ing.amount ? raw : formatDecimal(ing.amount);
  }

  setAmountText(ing: IngredientForm, text: string): void {
    this.rawAmounts.set(ing, text);
    ing.amount = parseDecimal(text);
  }

  readonly parseDecimal = parseDecimal;
  readonly formatDecimal = formatDecimal;

  readonly isModalOpen = signal(false);
  readonly editId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  form: RecipeForm = emptyForm();

  /** Zustand beim Öffnen; ein Import startet mit leerem Stand und gilt damit als geändert. */
  private baseline = JSON.stringify(emptyForm());
  private allowClose = false;

  isDirty(): boolean {
    return JSON.stringify(this.form) !== this.baseline;
  }

  /** canDismiss des Rezept-Sheets: bei ungespeicherten Änderungen „Verwerfen?“. */
  readonly canDismissRecipe = async (): Promise<boolean> => {
    if (this.allowClose || !this.isDirty()) return true;
    return confirmDiscard(this.alerts);
  };

  // --- Zutaten-Picker (nt-food-sources) ---
  readonly pickerOpen = signal(false);

  /** Nimmt ein Rezept-Foto (native Kamera) auf und importiert es via KI. */
  async importFromCamera(): Promise<void> {
    this.importError.set(null);
    this.importPhotoScanning.set(true);
    try {
      const base64 = await this.camera.takePhotoBase64();
      await this.runImportFromBase64(base64);
    } catch (e: unknown) {
      this.importError.set(importErrorMessage(e, this.isOffline()));
    } finally {
      this.importPhotoScanning.set(false);
    }
  }

  /** Liest ein Rezept-Foto (Datei-Upload) und importiert es via KI. */
  async onImportPhotoFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importError.set(null);
    this.importPhotoScanning.set(true);
    try {
      const base64 = await this.fileToBase64(file);
      await this.runImportFromBase64(base64);
    } catch (e: unknown) {
      this.importError.set(importErrorMessage(e, this.isOffline()));
    } finally {
      this.importPhotoScanning.set(false);
      input.value = '';
    }
  }

  private async runImportFromBase64(base64: string): Promise<void> {
    if (!this.isLive()) throw new Error('Foto-Import braucht die KI, sie ist gerade nicht verbunden.');
    const res = await this.ai.importRecipe({ imageBase64: await shrinkPhotoForUpload(base64) });
    if (res.ingredients.length === 0) throw new Error('Auf dem Foto wurden keine Zutaten erkannt.');
    this.form = formFromImport(res);
    this._importOrigin = 'photo';
    this.baseline = '';
    this.editId.set(null);
    this.error.set(null);
    this.importOpen.set(false);
    this.isModalOpen.set(true);
    this.toastMessage.set('Rezept aus Foto erkannt — bitte prüfen und speichern.');
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });
  }

  constructor() {
    effect(() => {
      const requested = this.queryParams()?.get('view');
      if (requested === 'meals' || requested === 'recipes') this.view.set(requested);
    });
  }

  ngOnDestroy(): void {
    this.deletion.flush();
  }

  onViewChange(event: CustomEvent<{ value?: string | number }>): void {
    this.view.set(event.detail.value === 'meals' ? 'meals' : 'recipes');
  }

  /** Das Plus-Symbol legt je nach Segment ein Rezept oder eine Mahlzeit an. */
  onFabClick(): void {
    if (this.view() === 'meals') this.mealsList()?.openCreate();
    else this.openAdd();
  }

  // --- Live-Nährwerte (aus den Zutaten berechnet) ---
  private toIngredients(): RecipeIngredient[] {
    return toRecipeIngredients(this.form.ingredients);
  }

  /** Automatisch berechnetes Gesamtgewicht für Anzeige im Formular. */
  autoWeightG(): number {
    return totalWeightG(this.toIngredients());
  }

  /** True wenn Näherungseinheiten (EL, TL, Stk …) im Rezept vorkommen. */
  autoWeightIsApprox(): boolean {
    return hasApproxUnits(this.toIngredients());
  }

  /** Wert im Feld „Fertig gekocht“: eigene Eingabe, sonst das berechnete Gewicht. */
  cookedWeightValue(): number | null {
    return cookedWeightValue(this.form.cookedWeightG, this.autoWeightG());
  }

  /** True, solange das Gewicht nur geschätzt (aus den Zutaten berechnet) ist. */
  cookedWeightIsEstimate(): boolean {
    return cookedWeightIsEstimate(this.form.cookedWeightG, this.autoWeightG());
  }

  setCookedWeight(value: unknown): void {
    this.form.cookedWeightG = nextCookedWeight(value, this.autoWeightG());
  }

  total(): NutritionFacts {
    return totalFacts(this.toIngredients());
  }

  perServing(): NutritionFacts {
    return perServingFacts(this.toIngredients(), this.form.servings ?? 1);
  }

  hasNutrition(): boolean {
    return hasNutrition(this.toIngredients());
  }

  /** Zutaten im Formular ohne Nährwerte (zählen in der Summe als 0). */
  missingCount(): number {
    return countMissingFacts(this.toIngredients());
  }

  /** True, wenn das gerade bearbeitete Rezept aus einem KI-Import stammt. */
  formIsAi(): boolean {
    return isAiOrigin(this._importOrigin);
  }

  /** True, wenn die Zutat nur kcal hat (Eiweiß/KH/Fett fehlen): „Nährwerte unvollständig“. */
  isIncomplete(ing: IngredientForm): boolean {
    return hasIncompleteFacts(ing.facts);
  }

  // --- Modal öffnen/schließen ---
  openAdd(): void {
    this._importOrigin = 'own';
    this.form = emptyForm();
    this.baseline = JSON.stringify(this.form);
    this.allowClose = false;
    this.editId.set(null);
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(recipe: Recipe): void {
    this.form = formFromRecipe(recipe);
    this._importOrigin = recipe.origin ?? 'own';
    this.baseline = JSON.stringify(this.form);
    this.allowClose = false;
    this.editId.set(recipe.id);
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  /** X-Taste: erst fragen (canDismiss-Logik), nur bei Ja schließen; bei „Weiter bearbeiten“ bleibt der Zustand offen. */
  async requestCloseModal(): Promise<void> {
    if (!(await this.canDismissRecipe())) return;
    this.allowClose = true;
    this.isModalOpen.set(false);
  }

  closeModal(): void {
    this.allowClose = false;
    this.isModalOpen.set(false);
  }

  /** Öffnet die Online-Rezeptsuche (spoonacular) als Sheet. */
  async openOnlineSearch(): Promise<void> {
    // Doppel-Tipp: sonst lagen zwei Sheets uebereinander.
    if (this.onlineSearchOpening) return;
    this.onlineSearchOpening = true;
    try {
      const modal = await this.modals.create({ component: OnlineSearchComponent });
      await modal.present();
    } finally {
      this.onlineSearchOpening = false;
    }
  }

  private onlineSearchOpening = false;

  // --- Import ---
  openImport(): void {
    this.importText = '';
    this.importUrl = '';
    this.importError.set(null);
    this.importBusy.set(false);
    this.importOpen.set(true);
  }

  closeImport(): void {
    this.importOpen.set(false);
  }

  isTikTokUrl(url: string): boolean {
    return /tiktok\.com/i.test(url);
  }

  /** Parst Text/URL via KI zu einem Rezept und öffnet das Formular vorbefüllt. */
  async runImport(): Promise<void> {
    const text = this.importText.trim();
    const url = this.isLive() ? this.importUrl.trim() : '';
    if (!text && !url) {
      this.importError.set(importBlockReason(text, url));
      return;
    }
    if (url && this.isTikTokUrl(url) && !this.isLive()) {
      this.importError.set(
        'TikTok-Import braucht die KI, sie ist gerade nicht verbunden. Füge den Beschreibungstext des Videos ein.',
      );
      return;
    }
    this.importError.set(null);
    this.importBusy.set(true);
    const isTikTok = url && this.isTikTokUrl(url);
    try {
      const res = await this.ai.importRecipe({ text: text || undefined, url: url || undefined });
      if (res.ingredients.length === 0) throw new Error('Keine Zutaten erkannt.');
      this.form = formFromImport(res);
      this._importOrigin = isTikTok ? 'tiktok' : (url ? 'url' : 'text');
      this.baseline = '';
      this.editId.set(null);
      this.error.set(null);
      this.importOpen.set(false);
      this.isModalOpen.set(true);
      this.toastMessage.set(
        this.isLive()
          ? `Rezept${isTikTok ? ' aus TikTok' : ''} importiert — bitte prüfen und speichern.`
          : 'Rezept aus Text erkannt — Nährwerte je Zutat prüfen oder ergänzen.',
      );
    } catch (e: unknown) {
      this.importError.set(importErrorMessage(e, this.isOffline()));
    } finally {
      this.importBusy.set(false);
    }
  }

  private isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private _importOrigin: 'own' | 'url' | 'tiktok' | 'photo' | 'text' | 'online' = 'own';

  // --- Zutaten ---
  removeIngredient(index: number): void {
    this.form.ingredients = this.form.ingredients.filter((_, i) => i !== index);
  }

  /** „Manuell eintragen“ aus der Suche: leere Zutat mit dem Suchbegriff als Name. */
  addManualFromSearch(name: string): void {
    this.form.ingredients = [...this.form.ingredients, { name: name.trim(), amount: null, unit: 'g' }];
    this.closePicker();
  }

  addManualIngredient(): void {
    this.form.ingredients = [...this.form.ingredients, { name: '', amount: null, unit: 'g' }];
  }

  kcalOf(ing: IngredientForm): number {
    return this.factsOf(ing).kcal;
  }

  /** Skalierte Nährwerte einer Zutat (für Menge/Einheit) zur Detail-Anzeige. */
  factsOf(ing: IngredientForm): NutritionFacts {
    return ingredientFacts({
      name: ing.name,
      amount: positiveOrZero(ing.amount),
      unit: ing.unit,
      facts: ing.facts,
    });
  }

  // --- Zutat-Detail (Nährwerte ansehen / manuell eintragen) ---
  readonly expandedIndex = signal<number | null>(null);

  toggleIngredient(index: number): void {
    this.expandedIndex.set(this.expandedIndex() === index ? null : index);
  }

  isExpanded(index: number): boolean {
    return this.expandedIndex() === index;
  }

  /** Legt ein leeres Nährwert-Objekt (je 100 g) für die manuelle Eingabe an. */
  enableManualFacts(ing: IngredientForm): void {
    if (ing.facts) return;
    ing.facts = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, basis: 'per100g' };
  }

  /** Inline-Eingabe: erster kcal-Wert legt die Nährwerte (je 100 g) an. */
  startFactsWithKcal(ing: IngredientForm, value: unknown): void {
    const kcal = parseDecimal(value);
    if (kcal === null) return;
    this.enableManualFacts(ing);
    this.setFact(ing, 'kcal', kcal);
  }

  /** True, wenn die Zutat (noch) keine Nährwerte hat → Hinweis zum Eintragen. */
  needsManualFacts(ing: IngredientForm): boolean {
    return !ing.facts;
  }

  // --- Schritte ---
  addStep(): void {
    this.form.steps = [...this.form.steps, ''];
  }

  removeStep(index: number): void {
    const next = this.form.steps.filter((_, i) => i !== index);
    this.form.steps = next.length ? next : [''];
  }

  trackIndex(index: number): number {
    return index;
  }

  // --- Zutaten-Picker ---
  openPicker(): void {
    this.pickerOpen.set(true);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  /** Übernimmt einen Food-Treffer als Zutat (Standardmenge = Portion oder 100 g). */
  pickSource(res: FoodSourceResult): void {
    const amount = res.servingG && res.servingG > 0 ? Math.round(res.servingG) : 100;
    const name = res.name.trim() || 'Zutat';
    this.form.ingredients = [
      ...this.form.ingredients,
      { name, amount, unit: 'g', facts: res.facts, foodItemId: res.foodItemId },
    ];
    this.closePicker();
    this.toastMessage.set(`„${name}" als Zutat hinzugefügt.`);
  }

  setFact(ing: IngredientForm, key: FactKey, value: unknown): void {
    if (!ing.facts) return;
    ing.facts = applyFact(ing.facts, key, value);
  }

  // --- Speichern ---
  save(): void {
    const result = buildRecipeDraft(this.form, this._importOrigin);
    if ('error' in result) {
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    const draft = result.draft;
    this._importOrigin = 'own';

    const id = this.editId();
    if (id) this.store.update(id, draft);
    else this.store.add(draft);
    this.allowClose = true;
    this.isModalOpen.set(false);
    this.toastMessage.set(id ? 'Rezept aktualisiert.' : 'Rezept gespeichert.');
  }

  /** Blendet das Rezept aus und zeigt „Rezept gelöscht – Rückgängig“. */
  remove(id: string): void {
    this.deletion.start(id);
    this.undoOpen.set(true);
  }

  onUndoDismiss(event: CustomEvent<{ role?: string }>): void {
    settleUndoToast(this.deletion, event.detail?.role);
    this.undoOpen.set(false);
  }

  /**
   * Loggt eine Portion des Rezepts ins heutige Tagebuch. Die Mahlzeit wird
   * erst hier (beim Klick) abgefragt — sie wird nicht am Rezept gespeichert.
   */
  async logToDiary(recipe: Recipe): Promise<void> {
    const meal = await pickMealSheet(this.actionSheets);
    if (!meal) return;
    const portions = await askPortionsSheet(this.actionSheets);
    if (portions === null) return;
    this.logMeal(recipe, meal, portions);
  }

  private logMeal(recipe: Recipe, meal: MealType, portions: number): void {
    const missing = countMissingFacts(recipe.ingredients);
    this.diary.add(recipeDiaryEntry(recipe, meal, portions, toDateISO()));
    const hint = missing > 0 ? ` Unvollständig: ${missingFactsLabel(missing)}, Werte sind eine Untergrenze.` : '';
    this.toastMessage.set(`${servingsLabel(portions)} „${recipe.title}" als ${mealLabel(meal)} eingetragen.${hint}`);
  }

  onToastDismiss(): void {
    this.toastMessage.set(null);
  }

  // --- Karten-Menü (Bearbeiten/Löschen) ---
  async openCardMenu(recipe: Recipe): Promise<void> {
    const choice = await cardMenuSheet(this.actionSheets, recipe.title);
    if (choice === 'edit') this.openEdit(recipe);
    if (choice === 'delete') this.remove(recipe.id);
  }

  // --- Nur-Lesen-Detail ---
  readonly detailRecipe = signal<Recipe | null>(null);

  openDetail(recipe: Recipe): void {
    this.detailRecipe.set(recipe);
  }

  closeDetail(): void {
    this.detailRecipe.set(null);
  }

  /** Schließt das Detail und führt dann die Aktion aus. */
  detailThen(action: (r: Recipe) => void): void {
    const r = this.detailRecipe();
    this.closeDetail();
    if (r) action(r);
  }

  readonly editAction = (r: Recipe): void => this.openEdit(r);
  readonly diaryAction = (r: Recipe): void => void this.logToDiary(r);
  readonly cookAction = (r: Recipe): void => this.startCook(r);

  // --- Kochmodus ---
  readonly cookRecipe = signal<Recipe | null>(null);

  startCook(recipe: Recipe): void {
    // Offene Hinweise würden „Weiter“ verdecken.
    this.toastMessage.set(null);
    this.detailRecipe.set(null);
    this.cookRecipe.set(recipe);
  }

  closeCook(): void {
    this.cookRecipe.set(null);
  }
}
