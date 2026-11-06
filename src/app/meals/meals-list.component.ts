import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { NumPipe } from '../shared/num.pipe';
import { FoodItem, MealType, NutritionFacts, Recipe, SavedMeal, SavedMealEntry } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { MealsStore } from '../core/state/meals.store';
import { RecipeStore } from '../core/state/recipe.store';
import { toDateISO } from '../core/util/date';
import { confirmDiscard } from './confirm-discard';
import { isMealDraftChanged, mealSaveBlockReason, rescaleEntryAmount } from './meal-draft';
import { UNDO_TOAST_BUTTONS, UNDO_TOAST_MS, UndoableDelete, settleUndoToast } from './undoable-delete';

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
  private readonly actionSheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);
  private allowClose = false;

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
  draftEntries: SavedMealEntry[] = [];
  /** id der gerade bearbeiteten Mahlzeit; null = neue Mahlzeit. */
  readonly editingId = signal<string | null>(null);
  /** Ausgangszustand des Entwurfs (für „Verwerfen?“). */
  private baseline: { name: string; entries: SavedMealEntry[] } = { name: '', entries: [] };

  // --- Food search within create modal ---
  readonly pickerOpen = signal(false);

  ngOnDestroy(): void {
    this.deletion.flush();
  }

  /** Grund, warum „Mahlzeit speichern“ gerade gesperrt ist (leer = bereit). */
  saveBlockReason(): string {
    return mealSaveBlockReason(this.draftName, this.draftEntries.length);
  }

  /** canDismiss: bei ungespeichertem Entwurf „Verwerfen?“. */
  readonly canDismissCreate = async (): Promise<boolean> => {
    if (this.allowClose || !isMealDraftChanged(this.baseline, this.draftName, this.draftEntries)) return true;
    return confirmDiscard(this.alerts);
  };

  openCreate(): void {
    this.openDraft(null, '', []);
  }

  /** Öffnet den Editor mit den Daten einer gespeicherten Mahlzeit. */
  openEdit(meal: SavedMeal): void {
    this.openDraft(meal.id, meal.name, meal.entries);
  }

  private openDraft(id: string | null, name: string, entries: SavedMealEntry[]): void {
    this.allowClose = false;
    this.editingId.set(id);
    this.draftName = name;
    this.draftEntries = [...entries];
    this.baseline = { name, entries: [...entries] };
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.allowClose = false;
    this.createOpen.set(false);
  }

  saveMeal(): void {
    if (this.saveBlockReason()) return;
    const draft = { name: this.draftName, entries: this.draftEntries };
    const id = this.editingId();
    if (id) this.store.update(id, draft);
    else this.store.add(draft);
    this.allowClose = true;
    this.createOpen.set(false);
    this.toastMessage.set(`„${this.draftName.trim()}" gespeichert.`);
  }

  removeEntry(index: number): void {
    this.draftEntries = this.draftEntries.filter((_, i) => i !== index);
  }

  totalDraftKcal(): number {
    return Math.round(this.draftEntries.reduce((s, e) => s + e.facts.kcal, 0));
  }

  /** Ändert die Menge eines Eintrags (g); Nährwerte werden mitskaliert. */
  setEntryAmount(index: number, event: Event): void {
    const value = Number((event as CustomEvent<{ value?: string | number | null }>).detail?.value);
    if (!(value > 0)) return;
    this.draftEntries = this.draftEntries.map((e, i) => (i === index ? rescaleEntryAmount(e, value) : e));
  }

  addRecipeToDraft(recipe: Recipe): void {
    if (!recipe.factsPerServing) return;
    this.draftEntries = [...this.draftEntries, {
      label: recipe.title,
      facts: recipe.factsPerServing,
      ref: { kind: 'manual' },
    }];
  }

  // --- Food picker ---
  openPicker(): void {
    this.pickerOpen.set(true);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
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
    this.draftEntries = [...this.draftEntries, { label: item.name, facts: scaled, amountG, ref: { kind: 'manual' } }];
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
