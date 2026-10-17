import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import type { IScannerControls } from '@zxing/browser';
import { ActionSheetController } from '@ionic/angular';
import { FoodItem, MealType, NutritionFacts, Recipe, RecipeIngredient } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { FOOD_PROVIDER } from '../core/food/food-provider';
import { BarcodeScannerService } from '../core/scan/barcode-scanner.service';
import { CameraService } from '../core/scan/camera.service';
import { DiaryStore } from '../core/state/diary.store';
import { RecipeDraft, RecipeStore } from '../core/state/recipe.store';
import {
  perServingFacts,
  totalFacts,
  hasNutrition,
  ingredientFacts,
} from '../core/nutrition/recipe-nutrition';
import { toDateISO } from '../core/util/date';

interface IngredientForm {
  name: string;
  amount: number | null;
  unit: string;
  facts?: NutritionFacts;
  foodItemId?: string;
}

interface RecipeForm {
  title: string;
  servings: number | null;
  cookedWeightG: number | null;
  ingredients: IngredientForm[];
  steps: string[];
}

function emptyForm(): RecipeForm {
  return { title: '', servings: 2, cookedWeightG: null, ingredients: [], steps: [''] };
}

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittagessen' },
  { value: 'dinner', label: 'Abendessen' },
  { value: 'snack', label: 'Snack' },
];

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
  private readonly food = inject(FOOD_PROVIDER);
  private readonly barcode = inject(BarcodeScannerService);
  private readonly camera = inject(CameraService);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly ai = inject(AiService);

  readonly nativeCamera = this.camera.isNativeCameraAvailable();
  readonly importPhotoScanning = signal(false);

  readonly mealOptions = MEAL_OPTIONS;

  // --- Rezept-Import (Text/URL via KI) ---
  readonly importOpen = signal(false);
  readonly importBusy = signal(false);
  readonly importError = signal<string | null>(null);
  importText = '';
  importUrl = '';

  isLive(): boolean {
    return this.ai.isLive();
  }

  @ViewChild('ingBarcodeVideo') barcodeVideo?: ElementRef<HTMLVideoElement>;

  readonly recipes = this.store.recipes;

  readonly isModalOpen = signal(false);
  readonly editId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  form: RecipeForm = emptyForm();

  // --- Zutaten-Picker (Suche + Barcode) ---
  readonly pickerOpen = signal(false);
  pickerQuery = '';
  readonly pickerResults = signal<FoodItem[]>([]);
  readonly pickerSearching = signal(false);
  readonly pickerError = signal<string | null>(null);

  /** Nimmt ein Rezept-Foto (native Kamera) auf und importiert es via KI. */
  async importFromCamera(): Promise<void> {
    this.importError.set(null);
    this.importPhotoScanning.set(true);
    try {
      const base64 = await this.camera.takePhotoBase64();
      await this.runImportFromBase64(base64);
    } catch (e: unknown) {
      this.importError.set(e instanceof Error ? e.message : 'Kamera nicht verfügbar.');
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
      this.importError.set(e instanceof Error ? e.message : 'Foto-Import fehlgeschlagen.');
    } finally {
      this.importPhotoScanning.set(false);
      input.value = '';
    }
  }

  private async runImportFromBase64(base64: string): Promise<void> {
    const res = await this.ai.importRecipe({ imageBase64: base64 });
    this.form = {
      title: res.title,
      servings: res.servings || 2,
      cookedWeightG: null,
      ingredients: res.ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        facts: i.facts,
      })),
      steps: res.steps.length ? [...res.steps] : [''],
    };
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

  // --- Barcode-Scanner im Picker (Vollbild) ---
  readonly bcOpen = signal(false);
  readonly bcError = signal<string | null>(null);
  readonly bcLooking = signal(false);
  readonly bcManualOpen = signal(false);
  manualBarcode = '';
  private scanControls?: IScannerControls;

  ngOnDestroy(): void {
    this.stopScanner();
  }

  // --- Live-Nährwerte (aus den Zutaten berechnet) ---
  private toIngredients(): RecipeIngredient[] {
    return this.form.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        amount: this.toNum(i.amount),
        unit: i.unit.trim() || 'g',
        facts: i.facts,
        foodItemId: i.foodItemId,
      }));
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

  // --- Modal öffnen/schließen ---
  openAdd(): void {
    this.form = emptyForm();
    this.editId.set(null);
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(recipe: Recipe): void {
    this.form = {
      title: recipe.title,
      servings: recipe.servings,
      cookedWeightG: recipe.cookedWeightG ?? null,
      ingredients: recipe.ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        facts: i.facts,
        foodItemId: i.foodItemId,
      })),
      steps: recipe.steps.length ? [...recipe.steps] : [''],
    };
    this.editId.set(recipe.id);
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

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

  /** Parst Text/URL via KI zu einem Rezept und öffnet das Formular vorbefüllt. */
  async runImport(): Promise<void> {
    const text = this.importText.trim();
    const url = this.importUrl.trim();
    if (!text && !url) {
      this.importError.set('Bitte Text einfügen oder eine URL angeben.');
      return;
    }
    this.importError.set(null);
    this.importBusy.set(true);
    try {
      const res = await this.ai.importRecipe({ text: text || undefined, url: url || undefined });
      this.form = {
        title: res.title,
        servings: res.servings || 2,
        cookedWeightG: null,
        ingredients: res.ingredients.map((i) => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
          facts: i.facts,
        })),
        steps: res.steps.length ? [...res.steps] : [''],
      };
      this.editId.set(null);
      this.error.set(null);
      this.importOpen.set(false);
      this.isModalOpen.set(true);
      this.toastMessage.set(
        this.isLive()
          ? 'Rezept importiert — bitte prüfen und speichern.'
          : 'Rezept aus Text erkannt (Mock) — Nährwerte ggf. je Zutat ergänzen.',
      );
    } catch {
      this.importError.set('Import fehlgeschlagen — bitte Text einfügen oder erneut versuchen.');
    } finally {
      this.importBusy.set(false);
    }
  }

  // --- Zutaten ---
  removeIngredient(index: number): void {
    this.form.ingredients = this.form.ingredients.filter((_, i) => i !== index);
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
      amount: this.toNum(ing.amount),
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
    this.pickerQuery = '';
    this.pickerResults.set([]);
    this.pickerError.set(null);
    this.pickerOpen.set(true);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  async searchFood(): Promise<void> {
    const q = this.pickerQuery.trim();
    if (!q) return;
    this.pickerError.set(null);
    this.pickerSearching.set(true);
    try {
      this.pickerResults.set(await this.food.searchByText(q));
      if (this.pickerResults().length === 0) this.pickerError.set('Keine Treffer gefunden.');
    } catch {
      this.pickerError.set('Suche fehlgeschlagen — bitte erneut versuchen.');
    } finally {
      this.pickerSearching.set(false);
    }
  }

  /** Übernimmt einen Food-Treffer als Zutat (Standardmenge = Portion oder 100 g). */
  pickFood(item: FoodItem): void {
    const amount = item.servingG && item.servingG > 0 ? Math.round(item.servingG) : 100;
    this.form.ingredients = [
      ...this.form.ingredients,
      { name: item.name, amount, unit: 'g', facts: item.facts, foodItemId: item.id },
    ];
    this.closePicker();
    this.toastMessage.set(`„${item.name}" als Zutat hinzugefügt.`);
  }

  // --- Barcode im Picker ---
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

  async onBarcodePresent(): Promise<void> {
    const video =
      this.barcodeVideo?.nativeElement ??
      (document.querySelector('video#ingBarcodeVideo') as HTMLVideoElement | null);
    if (!video || !this.barcode.isSupported()) return;
    try {
      this.scanControls = await this.barcode.start(
        video,
        (code) => this.lookupBarcode(code),
        () => this.bcError.set('Kamerazugriff fehlgeschlagen — Code manuell eingeben.'),
      );
    } catch {
      this.bcError.set('Kamera nicht verfügbar — Code manuell eingeben.');
    }
  }

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

  private async lookupBarcode(code: string): Promise<void> {
    if (this.bcLooking()) return;
    this.stopScanner();
    this.bcError.set(null);
    this.bcLooking.set(true);
    try {
      const item = await this.food.lookupByBarcode(code);
      if (!item) {
        this.bcError.set(`Kein Produkt zu Barcode ${code} gefunden.`);
        return;
      }
      this.closeBarcode();
      this.pickFood(item);
    } catch {
      this.bcError.set('Barcode-Abfrage fehlgeschlagen — bitte erneut versuchen.');
    } finally {
      this.bcLooking.set(false);
    }
  }

  private toNum(v: number | null): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  // --- Speichern ---
  save(): void {
    const title = this.form.title.trim();
    if (!title) {
      this.error.set('Bitte einen Titel eingeben.');
      return;
    }
    const servings = this.form.servings;
    if (servings === null || !Number.isFinite(servings) || servings < 1) {
      this.error.set('Portionen muss mindestens 1 sein.');
      return;
    }
    const ingredients = this.toIngredients();
    if (ingredients.length === 0) {
      this.error.set('Bitte mindestens eine Zutat hinzufügen.');
      return;
    }
    this.error.set(null);

    const draft: RecipeDraft = {
      title,
      servings: Math.floor(servings),
      cookedWeightG: this.form.cookedWeightG != null ? this.toNum(this.form.cookedWeightG) : undefined,
      ingredients,
      steps: this.form.steps.map((s) => s.trim()).filter(Boolean),
      origin: 'own',
      factsPerServing: perServingFacts(ingredients, servings),
    };

    const id = this.editId();
    if (id) this.store.update(id, draft);
    else this.store.add(draft);
    this.closeModal();
    this.toastMessage.set(id ? 'Rezept aktualisiert.' : 'Rezept gespeichert.');
  }

  remove(id: string): void {
    this.store.remove(id);
  }

  /**
   * Loggt eine Portion des Rezepts ins heutige Tagebuch. Die Mahlzeit wird
   * erst hier (beim Klick) abgefragt — sie wird nicht am Rezept gespeichert.
   */
  async logToDiary(recipe: Recipe): Promise<void> {
    if (!recipe.factsPerServing) return;
    const sheet = await this.actionSheets.create({
      header: 'Als welche Mahlzeit loggen?',
      buttons: [
        ...this.mealOptions.map((m) => ({ text: m.label, data: m.value })),
        { text: 'Abbrechen', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data, role } = await sheet.onDidDismiss<MealType>();
    if (role === 'cancel' || !data) return;
    this.logMeal(recipe, data);
  }

  private logMeal(recipe: Recipe, meal: MealType): void {
    if (!recipe.factsPerServing) return;
    this.diary.add({
      dateISO: toDateISO(),
      meal,
      label: recipe.title,
      ref: { kind: 'recipe', recipeId: recipe.id },
      servings: 1,
      facts: recipe.factsPerServing,
    });
    const mealLabel = this.mealOptions.find((m) => m.value === meal)?.label ?? 'Tagebuch';
    this.toastMessage.set(`„${recipe.title}" als ${mealLabel} gelegt.`);
  }

  onToastDismiss(): void {
    this.toastMessage.set(null);
  }

  // --- Kochmodus ---
  readonly cookRecipe = signal<Recipe | null>(null);
  readonly cookStep = signal(0);

  startCook(recipe: Recipe): void {
    this.cookRecipe.set(recipe);
    this.cookStep.set(0);
  }

  closeCook(): void {
    this.cookRecipe.set(null);
    this.cookStep.set(0);
  }

  cookNext(): void {
    const r = this.cookRecipe();
    if (!r) return;
    this.cookStep.update(s => Math.min(s + 1, r.steps.length - 1));
  }

  cookPrev(): void {
    this.cookStep.update(s => Math.max(s - 1, 0));
  }
}
