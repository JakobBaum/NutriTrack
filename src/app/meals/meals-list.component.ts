import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { NumPipe } from '../shared/num.pipe';
import { FoodItem, MealType, NutritionFacts, Recipe, SavedMeal } from '../core/models';
import { FOOD_PROVIDER } from '../core/food/food-provider';
import { foodErrorMessage } from '../core/food/food-errors';
import { DiaryStore } from '../core/state/diary.store';
import { MealsStore } from '../core/state/meals.store';
import { RecipeStore } from '../core/state/recipe.store';
import { toDateISO } from '../core/util/date';
import { UNDO_TOAST_BUTTONS, UNDO_TOAST_MS, UndoableDelete, settleUndoToast } from './undoable-delete';

interface DraftEntry {
  label: string;
  facts: NutritionFacts;
  amountG?: number;
}

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittagessen' },
  { value: 'dinner', label: 'Abendessen' },
  { value: 'snack', label: 'Snack' },
];

/**
 * Gespeicherte Mahlzeiten (Vorlagen aus Lebensmitteln und Rezepten): Liste,
 * anlegen, ins Tagebuch übernehmen und löschen (mit Rückgängig). Wird in der
 * Rezepte-Seite unter dem Segment „Mahlzeiten“ angezeigt.
 */
@Component({
  selector: 'app-meals-list',
  templateUrl: './meals-list.component.html',
  styleUrls: ['./meals-list.component.scss'],
  imports: [SharedModule, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MealsListComponent implements OnDestroy {
  private readonly store = inject(MealsStore);
  private readonly diary = inject(DiaryStore);
  private readonly recipeStore = inject(RecipeStore);
  private readonly food = inject(FOOD_PROVIDER);
  private readonly actionSheets = inject(ActionSheetController);

  private readonly deletion = new UndoableDelete((id) => this.store.remove(id));

  /** Gespeicherte Mahlzeiten ohne die gerade zum Löschen vorgemerkte. */
  readonly meals = computed(() => this.store.meals().filter((m) => m.id !== this.deletion.pendingId()));
  readonly recipes = this.recipeStore.recipes;
  readonly mealOptions = MEAL_OPTIONS;

  readonly toastMessage = signal<string | null>(null);
  readonly undoOpen = signal(false);
  readonly undoDuration = UNDO_TOAST_MS;
  readonly undoButtons = UNDO_TOAST_BUTTONS;

  // --- Create modal ---
  readonly createOpen = signal(false);
  draftName = '';
  draftEntries: DraftEntry[] = [];

  // --- Food search within create modal ---
  readonly pickerOpen = signal(false);
  pickerQuery = '';
  readonly pickerResults = signal<FoodItem[]>([]);
  readonly pickerSearching = signal(false);
  readonly pickerError = signal<string | null>(null);

  ngOnDestroy(): void {
    this.deletion.flush();
  }

  openCreate(): void {
    this.draftName = '';
    this.draftEntries = [];
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  saveMeal(): void {
    if (!this.draftName.trim()) return;
    if (this.draftEntries.length === 0) return;
    this.store.add({
      name: this.draftName.trim(),
      entries: this.draftEntries.map((e) => ({
        label: e.label,
        facts: e.facts,
        amountG: e.amountG,
        ref: { kind: 'manual' },
      })),
    });
    this.createOpen.set(false);
    this.toastMessage.set(`„${this.draftName.trim()}" gespeichert.`);
  }

  removeEntry(index: number): void {
    this.draftEntries = this.draftEntries.filter((_, i) => i !== index);
  }

  totalDraftKcal(): number {
    return Math.round(this.draftEntries.reduce((s, e) => s + e.facts.kcal, 0));
  }

  addRecipeToDraft(recipe: Recipe): void {
    if (!recipe.factsPerServing) return;
    this.draftEntries = [...this.draftEntries, {
      label: recipe.title,
      facts: recipe.factsPerServing,
    }];
  }

  // --- Food picker ---
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
      if (this.pickerResults().length === 0) this.pickerError.set('Keine Treffer.');
    } catch (e: unknown) {
      this.pickerError.set(foodErrorMessage(e));
    } finally {
      this.pickerSearching.set(false);
    }
  }

  pickFood(item: FoodItem): void {
    const amountG = item.servingG && item.servingG > 0 ? Math.round(item.servingG) : 100;
    const factor = item.facts.basis === 'per100g' ? amountG / 100 : 1;
    const scaled: NutritionFacts = {
      ...item.facts,
      kcal: Math.round(item.facts.kcal * factor),
      proteinG: Math.round(item.facts.proteinG * factor * 10) / 10,
      carbsG: Math.round(item.facts.carbsG * factor * 10) / 10,
      fatG: Math.round(item.facts.fatG * factor * 10) / 10,
      basis: 'perPortion',
    };
    this.draftEntries = [...this.draftEntries, { label: item.name, facts: scaled, amountG }];
    this.closePicker();
  }

  // --- Use saved meal → add to diary ---
  async useMeal(meal: SavedMeal): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: `„${meal.name}" als welche Mahlzeit?`,
      buttons: [
        ...this.mealOptions.map((m) => ({ text: m.label, data: m.value })),
        { text: 'Abbrechen', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data, role } = await sheet.onDidDismiss<MealType>();
    if (role === 'cancel' || !data) return;

    const date = toDateISO();
    for (const entry of meal.entries) {
      this.diary.add({
        dateISO: date,
        meal: data,
        label: entry.label,
        facts: entry.facts,
        amountG: entry.amountG,
        ref: entry.ref,
      });
    }
    const mealLabel = this.mealOptions.find((m) => m.value === data)?.label ?? 'Tagebuch';
    this.toastMessage.set(`„${meal.name}" als ${mealLabel} eingetragen (${meal.entries.length} Einträge).`);
  }

  /** Blendet die Mahlzeit aus und zeigt „Mahlzeit gelöscht – Rückgängig“. */
  removeMeal(id: string): void {
    this.deletion.start(id);
    this.undoOpen.set(true);
  }

  onUndoDismiss(event: CustomEvent<{ role?: string }>): void {
    settleUndoToast(this.deletion, event.detail?.role);
    this.undoOpen.set(false);
  }

  totalKcal(meal: SavedMeal): number {
    return this.store.totalKcal(meal);
  }

  onToastDismiss(): void {
    this.toastMessage.set(null);
  }
}
