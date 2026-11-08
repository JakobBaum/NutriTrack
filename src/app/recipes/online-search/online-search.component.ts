import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/lazy';
import { RecipeSearchConfigStore } from '../../core/state/recipe-search-config.store';
import { RecipeStore } from '../../core/state/recipe.store';
import { OnlineRecipe } from '../../core/recipes/online/online-recipe.model';
import { RecipeTranslateService } from '../../core/recipes/online/recipe-translate';
import { OnlineSearchError } from '../../core/recipes/online/spoonacular.errors';
import { toRecipeDraft } from '../../core/recipes/online/spoonacular.mapper';
import { SpoonacularProvider } from '../../core/recipes/online/spoonacular.provider';
import {
  DIET_OPTIONS,
  KCAL_LIMIT,
  OnlineSearchFilters,
  TIME_OPTIONS,
} from '../../core/recipes/online/spoonacular.query';
import { toOnlineSearchError } from '../../core/recipes/online/spoonacular.errors';

export const SPOONACULAR_URL = 'https://spoonacular.com/food-api';

/**
 * Online-Rezeptsuche (Sheet): Suche mit Filtern, Trefferliste, Detailansicht mit Zutaten und
 * Anleitung und „Als Rezept speichern“ in die normale Rezeptliste.
 */
@Component({
  selector: 'app-online-search',
  templateUrl: './online-search.component.html',
  styleUrls: ['./online-search.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineSearchComponent {
  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);
  private readonly provider = inject(SpoonacularProvider);
  private readonly config = inject(RecipeSearchConfigStore);
  private readonly recipeStore = inject(RecipeStore);
  private readonly translator = inject(RecipeTranslateService);

  readonly dietOptions = DIET_OPTIONS;
  readonly timeOptions = TIME_OPTIONS;
  readonly kcalLimit = KCAL_LIMIT;
  readonly spoonacularUrl = SPOONACULAR_URL;

  readonly query = signal('');
  readonly maxCalories = signal<number | null>(null);
  readonly maxReadyTime = signal(0);
  readonly diet = signal('');

  readonly results = signal<OnlineRecipe[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly searched = signal(false);
  readonly selected = signal<OnlineRecipe | null>(null);
  readonly quotaLeft = this.provider.quotaLeft;

  readonly canTranslate = this.translator.canTranslate();
  readonly translateOn = signal(this.canTranslate);
  readonly translating = signal(false);
  private readonly translations = signal<ReadonlyMap<string, OnlineRecipe>>(new Map());
  private readonly savedIds = signal<ReadonlySet<string>>(new Set());
  readonly toast = signal<string | null>(null);

  readonly hasKey = computed(() => this.config.config().apiKey.trim().length > 0);
  readonly hasMore = computed(() => this.results().length < this.total());
  /** Angezeigtes Rezept: übersetzt, wenn der Schalter an ist und eine Übersetzung vorliegt. */
  readonly shown = computed(() => {
    const sel = this.selected();
    if (!sel) return null;
    return (this.translateOn() ? this.translations().get(sel.id) : undefined) ?? sel;
  });
  readonly isSaved = computed(() => {
    const sel = this.selected();
    return sel ? this.savedIds().has(sel.id) : false;
  });

  private filters(): OnlineSearchFilters {
    return {
      query: this.query(),
      maxCalories: this.maxCalories(),
      maxReadyTime: this.maxReadyTime() || null,
      diet: this.diet(),
    };
  }

  async search(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.provider.search(this.filters());
      this.results.set(page.recipes);
      this.total.set(page.totalResults);
    } catch (e: unknown) {
      this.results.set([]);
      this.total.set(0);
      this.error.set(toOnlineSearchError(e, false).message);
    } finally {
      this.searched.set(true);
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.error.set(null);
    try {
      const page = await this.provider.search(this.filters(), this.results().length);
      this.results.update((list) => [...list, ...page.recipes.filter((r) => !list.some((o) => o.id === r.id))]);
      this.total.set(page.totalResults);
    } catch (e: unknown) {
      this.error.set(e instanceof OnlineSearchError ? e.message : toOnlineSearchError(e, false).message);
    } finally {
      this.loadingMore.set(false);
    }
  }

  setMaxCalories(value: number | null): void {
    this.maxCalories.set(value);
  }

  async open(recipe: OnlineRecipe): Promise<void> {
    this.selected.set(recipe);
    await this.ensureTranslation();
  }

  back(): void {
    this.selected.set(null);
  }

  async setTranslate(on: boolean): Promise<void> {
    this.translateOn.set(on);
    if (on) await this.ensureTranslation();
  }

  private async ensureTranslation(): Promise<void> {
    const sel = this.selected();
    if (!sel || !this.translateOn() || !this.canTranslate || this.translations().has(sel.id)) return;
    this.translating.set(true);
    const translated = await this.translator.toGerman(sel);
    this.translations.update((m) => new Map(m).set(sel.id, translated));
    this.translating.set(false);
  }

  save(): void {
    const recipe = this.shown();
    const sel = this.selected();
    if (!recipe || !sel || this.isSaved()) return;
    this.recipeStore.add(toRecipeDraft(recipe));
    this.savedIds.update((s) => new Set(s).add(sel.id));
    this.toast.set('Rezept gespeichert. Du findest es in deiner Rezeptliste.');
  }

  openSettings(): void {
    void this.modal.dismiss();
    void this.router.navigate(['/settings'], { queryParams: { open: 'recipe-search' } });
  }

  close(): void {
    void this.modal.dismiss();
  }

  metaLine(r: OnlineRecipe): string {
    const parts: string[] = [];
    if (r.facts) parts.push(`${r.facts.kcal} kcal`);
    parts.push(r.servings === 1 ? '1 Portion' : `${r.servings} Portionen`);
    if (r.readyInMinutes) parts.push(`${r.readyInMinutes} Min`);
    return parts.join(' · ');
  }

  amountText(amount: number, unit: string): string {
    const n = amount > 0 ? String(amount).replace('.', ',') : '';
    return [n, unit].filter(Boolean).join(' ');
  }

  onToastDismiss(): void {
    this.toast.set(null);
  }
}
