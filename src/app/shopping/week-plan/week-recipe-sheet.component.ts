import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { toRecipeDraft } from '../../core/recipes/online/spoonacular.mapper';
import { RecipeStore } from '../../core/state/recipe.store';
import { isOnlineRecipeSaved } from '../../core/week-plan/week-plan-recipes';
import { WeekPlanRecipe } from '../../core/week-plan/week-plan.model';
import { CookIngredient } from '../../shared/cook-mode/cook-mode.component';
import { cookIngredients, recipeMetaLine } from './week-plan-format';

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
