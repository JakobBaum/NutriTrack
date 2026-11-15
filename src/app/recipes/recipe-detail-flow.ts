import { computed, signal } from '@angular/core';
import { recipeCookIngredients } from '../core/cook/recipe-cook-ingredients';
import { Recipe } from '../core/models';
import { StoredRecipe, isOnlineRef } from '../core/recipes/online/online-recipe-ref';
import { OnlineDetailLoader } from './online-detail-loader';

export const LOADING_TOAST = 'Rezept wird geladen …';

/** Aktionen, die das Detail nach dem Schließen auslöst. */
export type DetailAction = 'edit' | 'diary' | 'cook';

/** Anbindung an die Seite: Hinweise, Löschen und die Aktionen mit dem vollen Rezept. */
export interface DetailHost {
  toast(message: string | null): void;
  remove(id: string): void;
  edit(recipe: Recipe): void;
  diary(recipe: Recipe): Promise<void>;
}

/**
 * Nur-Lesen-Detail und Kochmodus der Rezeptliste. Online-Verweise werden vor dem Anzeigen,
 * Kochen, Bearbeiten und Eintragen aus dem Speicher-Cache oder bei Spoonacular geladen.
 */
export class RecipeDetailFlow {
  readonly recipe = signal<StoredRecipe | null>(null);
  readonly cook = signal<Recipe | null>(null);
  readonly cookIngredients = computed(() => recipeCookIngredients(this.cook()?.ingredients ?? []));

  constructor(
    readonly loader: OnlineDetailLoader,
    private readonly host: DetailHost,
  ) {}

  /** Öffnet das Detail; ein Verweis zeigt erst den Ladezustand und füllt sich dann. */
  async open(recipe: StoredRecipe): Promise<void> {
    this.recipe.set(recipe);
    const full = await this.loader.load(recipe);
    if (full && this.recipe()?.id === recipe.id) this.recipe.set(full);
  }

  close(): void {
    this.loader.cancel();
    this.recipe.set(null);
  }

  /** Lädt den offenen Verweis erneut („Erneut versuchen“). */
  retry(): void {
    const r = this.recipe();
    if (r) void this.open(r);
  }

  /** Löscht den Verweis auf ein bei Spoonacular entferntes Rezept. */
  removeRef(): void {
    const r = this.recipe();
    this.close();
    if (r) this.host.remove(r.id);
  }

  /** Schließt das Detail und führt dann die Aktion aus. */
  then(action: DetailAction): void {
    const r = this.recipe();
    this.close();
    if (r) void this.run(action, r);
  }

  run(action: DetailAction, recipe: StoredRecipe): Promise<void> {
    if (action === 'cook') return this.startCook(recipe);
    if (action === 'edit') return this.edit(recipe);
    return this.diary(recipe);
  }

  async edit(recipe: StoredRecipe): Promise<void> {
    const full = await this.ensureFull(recipe);
    if (full) this.host.edit(full);
  }

  private async diary(recipe: StoredRecipe): Promise<void> {
    const full = await this.ensureFull(recipe);
    if (full) await this.host.diary(full);
  }

  /**
   * Volles Rezept: eigene sofort, Verweise werden nachgeladen. Bei Fehler zeigt das Detail
   * den Fehlerzustand (Erneut versuchen / Verweis löschen).
   */
  async ensureFull(recipe: StoredRecipe): Promise<Recipe | null> {
    if (!isOnlineRef(recipe)) return recipe;
    this.host.toast(LOADING_TOAST);
    const full = await this.loader.load(recipe);
    this.host.toast(null);
    if (!full) this.recipe.set(recipe);
    return full;
  }

  async startCook(recipe: StoredRecipe): Promise<void> {
    const full = await this.ensureFull(recipe);
    if (!full) return;
    // Offene Hinweise würden „Weiter“ verdecken.
    this.host.toast(null);
    this.recipe.set(null);
    this.cook.set(full);
  }

  closeCook(): void {
    this.cook.set(null);
  }
}
