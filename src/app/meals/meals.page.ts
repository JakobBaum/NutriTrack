import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { FoodItem, MealType, NutritionFacts, Recipe, SavedMeal, SavedMealEntry } from '../core/models';
import { FOOD_PROVIDER } from '../core/food/food-provider';
import { DiaryStore } from '../core/state/diary.store';
import { MealsStore } from '../core/state/meals.store';
import { RecipeStore } from '../core/state/recipe.store';
import { toDateISO } from '../core/util/date';

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

@Component({
  selector: 'app-meals',
  templateUrl: './meals.page.html',
  styleUrls: ['./meals.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MealsPage {
  private readonly store = inject(MealsStore);
  private readonly diary = inject(DiaryStore);
  private readonly recipeStore = inject(RecipeStore);
  private readonly food = inject(FOOD_PROVIDER);
  private readonly actionSheets = inject(ActionSheetController);

  readonly meals = this.store.meals;
  readonly recipes = this.recipeStore.recipes;
  readonly mealOptions = MEAL_OPTIONS;

  readonly toastMessage = signal<string | null>(null);

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
      entries: this.draftEntries.map(e => ({
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
    } catch {
      this.pickerError.set('Suche fehlgeschlagen.');
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
        ...this.mealOptions.map(m => ({ text: m.label, data: m.value })),
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
    const mealLabel = this.mealOptions.find(m => m.value === data)?.label ?? 'Tagebuch';
    this.toastMessage.set(`„${meal.name}" als ${mealLabel} eingetragen (${meal.entries.length} Einträge).`);
  }

  removeMeal(id: string): void {
    this.store.remove(id);
  }

  totalKcal(meal: SavedMeal): number {
    return this.store.totalKcal(meal);
  }

  onToastDismiss(): void {
    this.toastMessage.set(null);
  }
}
