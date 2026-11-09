import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/lazy';
import { pickMealSheet } from '../../diary/diary-sheets';
import { showEntryToast } from '../../diary/entry-toast';
import { DiaryStore } from '../../core/state/diary.store';
import { toDateISO } from '../../core/util/date';
import { toRecipeDraft } from '../../core/recipes/online/spoonacular.mapper';
import { RecipeStore } from '../../core/state/recipe.store';
import { isOnlineRecipeSaved } from '../../core/week-plan/week-plan-recipes';
import { WeekPlanRecipe } from '../../core/week-plan/week-plan.model';
import { CookIngredient } from '../../shared/cook-mode/cook-mode.component';
import { cookIngredients, recipeMetaLine, weekRecipeToDiaryEntry } from './week-plan-format';

/**
 * Detail-Sheet eines Wochenplan-Rezepts: Bild, Eckdaten, „Zu Favoriten“, „Kochen“ (geteilter
 * Kochmodus mit Zutaten und Schritten) und Quelle.
 */
@Component({
  selector: 'app-week-recipe-sheet',
  templateUrl: './week-recipe-sheet.component.html',
  styleUrls: ['./week-recipe-sheet.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekRecipeSheetComponent {
  private readonly modal = inject(ModalController);
  private readonly recipeStore = inject(RecipeStore);
  private readonly diary = inject(DiaryStore);
  private readonly sheets = inject(ActionSheetController);
  private readonly toasts = inject(ToastController);

  @Input({ required: true }) recipe!: WeekPlanRecipe;
  @Input() persons = 1;

  readonly cooking = signal(false);

  isSaved(): boolean {
    return isOnlineRecipeSaved(this.recipeStore.recipes(), this.recipe);
  }

  save(): void {
    if (this.isSaved()) return;
    this.recipeStore.add(toRecipeDraft(this.recipe));
  }

  /** Eine Portion heute ins Tagebuch (Essenszeit per Auswahl, vorbelegt mit der Plan-Mahlzeit). */
  async logToDiary(): Promise<void> {
    if (!this.recipe.facts) return;
    const meal = await pickMealSheet(this.sheets, this.recipe.meal);
    if (!meal) return;
    const entry = weekRecipeToDiaryEntry(this.recipe, meal, toDateISO());
    if (!entry) return;
    const saved = this.diary.add(entry);
    void showEntryToast(this.toasts, 'Ins Tagebuch eingetragen.', () => this.diary.remove(saved.id));
  }

  startCook(): void {
    this.cooking.set(true);
  }

  endCook(): void {
    this.cooking.set(false);
  }

  ingredients(): CookIngredient[] {
    return cookIngredients(this.recipe, this.persons);
  }

  meta(): string {
    return recipeMetaLine(this.recipe);
  }

  close(): void {
    void this.modal.dismiss();
  }
}
