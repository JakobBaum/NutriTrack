import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Recipe } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { RecipeDraft, RecipeStore } from '../core/state/recipe.store';
import { toDateISO } from '../core/util/date';

interface IngredientForm {
  name: string;
  amount: number | null;
  unit: string;
}

interface RecipeForm {
  title: string;
  servings: number | null;
  ingredients: IngredientForm[];
  stepsText: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
}

function emptyForm(): RecipeForm {
  return {
    title: '',
    servings: 2,
    ingredients: [{ name: '', amount: null, unit: 'g' }],
    stepsText: '',
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    sugarG: null,
  };
}

/**
 * Rezepte: Liste eigener Rezepte, anlegen/bearbeiten, löschen und schnell
 * ins Tagebuch loggen. KI-Import (URL/TikTok/Foto) ist als Stub vorbereitet.
 */
@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.page.html',
  styleUrls: ['./recipes.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipesPage {
  private readonly store = inject(RecipeStore);
  private readonly diary = inject(DiaryStore);

  readonly recipes = this.store.recipes;

  readonly isModalOpen = signal(false);
  readonly editId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  form: RecipeForm = emptyForm();

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
      ingredients: recipe.ingredients.length
        ? recipe.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit }))
        : [{ name: '', amount: null, unit: 'g' }],
      stepsText: recipe.steps.join('\n'),
      kcal: recipe.factsPerServing?.kcal ?? null,
      proteinG: recipe.factsPerServing?.proteinG ?? null,
      carbsG: recipe.factsPerServing?.carbsG ?? null,
      fatG: recipe.factsPerServing?.fatG ?? null,
      fiberG: recipe.factsPerServing?.fiberG ?? null,
      sugarG: recipe.factsPerServing?.sugarG ?? null,
    };
    this.editId.set(recipe.id);
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  addIngredientRow(): void {
    this.form.ingredients = [...this.form.ingredients, { name: '', amount: null, unit: 'g' }];
  }

  removeIngredientRow(index: number): void {
    this.form.ingredients = this.form.ingredients.filter((_, i) => i !== index);
  }

  private toNum(v: number | null): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

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
    const kcal = this.form.kcal;
    if (kcal === null || !Number.isFinite(kcal) || kcal < 0) {
      this.error.set('Bitte gültige Kalorien je Portion eingeben.');
      return;
    }

    const draft: RecipeDraft = {
      title,
      servings: Math.floor(servings),
      ingredients: this.form.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), amount: this.toNum(i.amount), unit: i.unit.trim() || 'g' })),
      steps: this.form.stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      origin: 'own',
      factsPerServing: {
        kcal: Math.round(kcal),
        proteinG: this.toNum(this.form.proteinG),
        carbsG: this.toNum(this.form.carbsG),
        fatG: this.toNum(this.form.fatG),
        fiberG: this.toNum(this.form.fiberG),
        sugarG: this.toNum(this.form.sugarG),
        basis: 'perPortion',
      },
    };

    const id = this.editId();
    if (id) this.store.update(id, draft);
    else this.store.add(draft);
    this.closeModal();
  }

  remove(id: string): void {
    this.store.remove(id);
  }

  /** Loggt eine Portion des Rezepts in das heutige Tagebuch (Mittagessen). */
  logToDiary(recipe: Recipe): void {
    if (!recipe.factsPerServing) return;
    this.diary.add({
      dateISO: toDateISO(),
      meal: 'lunch',
      label: recipe.title,
      ref: { kind: 'recipe', recipeId: recipe.id },
      servings: 1,
      facts: recipe.factsPerServing,
    });
    this.toastMessage.set(`„${recipe.title}" ins Tagebuch gelegt.`);
  }

  /** Platzhalter für den KI-gestützten Rezept-Import. */
  importStub(): void {
    this.toastMessage.set('KI-Import (URL/TikTok/Foto) kommt in einer späteren Version.');
  }

  onToastDismiss(): void {
    this.toastMessage.set(null);
  }
}
