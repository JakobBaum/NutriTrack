import { HEALTH_NOTES } from '../../core/messages/health-notes';
import { TOAST_SWIPE_GESTURE } from '../../shared/toast-options';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { dietPrefsOf, hasDietPrefs } from '../../core/diet/diet-prefs';
import { dietSearchPrefs } from '../../core/diet/diet-search';
import { filterByDietPrefs } from '../../core/diet/diet-filter';
import { ProfileStore } from '../../core/state/profile.store';
import { RecipeSearchAccessService } from '../../core/recipes/online/recipe-search-access';
import { RecipeStore } from '../../core/state/recipe.store';
import { AppSettingsStore } from '../../core/state/app-settings.store';
import { formatQuantity } from '../../core/shopping/units/unit-format';
import { convertStepText } from '../../core/shopping/units/unit-text';
import { OnlineRecipe } from '../../core/recipes/online/online-recipe.model';
import { RecipeTranslateService } from '../../core/recipes/translate/recipe-translate';
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
  private readonly profileStore = inject(ProfileStore);
  private readonly provider = inject(SpoonacularProvider);
  private readonly access = inject(RecipeSearchAccessService);
  private readonly recipeStore = inject(RecipeStore);
  private readonly translator = inject(RecipeTranslateService);
  private readonly settings = inject(AppSettingsStore);

  readonly dietOptions = DIET_OPTIONS;
  readonly timeOptions = TIME_OPTIONS;
  readonly kcalLimit = KCAL_LIMIT;
  readonly spoonacularUrl = SPOONACULAR_URL;

  readonly query = signal('');
  readonly maxCalories = signal<number | null>(null);
  readonly maxReadyTime = signal(0);
  /** Ernährungsangaben des Profils; die Suche startet damit vorbelegt. */
  private readonly profilePrefs = computed(() => dietSearchPrefs(dietPrefsOf(this.profileStore.profile())));
  readonly hasProfileFilter = computed(() => hasDietPrefs(dietPrefsOf(this.profileStore.profile())));
  /** An: Ernährungsform, Unverträglichkeiten und Abneigungen aus dem Profil gelten für die Suche. */
  readonly profileFilterOn = signal(true);
  readonly diet = signal<string>(this.profilePrefs().diet);

  readonly results = signal<OnlineRecipe[]>([]);
  readonly total = signal(0);
  /** Anzahl beim Anbieter abgerufener Treffer (inkl. der durch Abneigungen ausgeblendeten); Grundlage für „Mehr laden“. */
  private readonly fetched = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly searched = signal(false);
  readonly selected = signal<OnlineRecipe | null>(null);
  readonly quotaLeft = this.provider.quotaLeft;

  /** Ohne KI-Verbindung gibt es nur das Wörterbuch: Suche und Rezepttexte bleiben dann überwiegend Englisch. */
  readonly canTranslate = this.translator.canTranslate();
  readonly nameFilterNote = HEALTH_NOTES.nameFilter;
  readonly translating = signal(false);
  private readonly translations = signal<ReadonlyMap<string, OnlineRecipe>>(new Map());
  private readonly savedIds = signal<ReadonlySet<string>>(new Set());
  readonly toast = signal<string | null>(null);
  readonly toastSwipe = TOAST_SWIPE_GESTURE;

  /** Ohne globalen Server (Worker) ist die Suche nicht verfügbar. */
  readonly needsSetup = computed(() => !this.access.isAvailable());
  readonly hasMore = computed(() => this.fetched() < this.total());
  /** True, wenn das Profil alle bisher geladenen Treffer ausblendet, es aber weitere beim Anbieter gibt. */
  readonly allHiddenByProfile = computed(
    () => this.profileFilterOn() && this.searched() && this.results().length === 0 && this.fetched() > 0 && this.hasMore(),
  );
  /** Angezeigtes Rezept: die Übersetzung, sobald sie vorliegt. */
  readonly shown = computed(() => {
    const sel = this.selected();
    if (!sel) return null;
    return this.translations().get(sel.id) ?? sel;
  });
  /** Hinweis, wenn das geöffnete Rezept nicht (vollständig) übersetzt werden konnte. */
  readonly showUntranslatedHint = computed(() => {
    const r = this.shown();
    return !!r && !this.translating() && r.lang === 'en';
  });
  readonly isSaved = computed(() => {
    const sel = this.selected();
    return sel ? this.savedIds().has(sel.id) : false;
  });

  private filters(): OnlineSearchFilters {
    const prefs = this.profileFilterOn() ? this.profilePrefs() : null;
    return {
      query: this.query(),
      maxCalories: this.maxCalories(),
      maxReadyTime: this.maxReadyTime() || null,
      diet: this.diet(),
      ...(prefs ? { intolerances: prefs.intolerances, excludeIngredients: prefs.excludeIngredients } : {}),
    };
  }

  /** Profil-Filter ein- oder ausschalten (aus: Suche ohne Profilangaben, auch ohne deren Ernährungsform). */
  async toggleProfileFilter(): Promise<void> {
    const on = !this.profileFilterOn();
    this.profileFilterOn.set(on);
    this.diet.set(on ? this.profilePrefs().diet : '');
    // Bereits gesucht: neu suchen, damit Treffer und Nachladen nie zwei Filtersätze mischen.
    if (this.searched()) await this.search();
  }

  /** Blendet Treffer mit Abneigungen aus (zusätzlich zum Filter beim Anbieter), solange der Profil-Filter an ist. */
  private visible(recipes: readonly OnlineRecipe[]): OnlineRecipe[] {
    return this.profileFilterOn() ? [...filterByDietPrefs(recipes, this.profilePrefs())] : [...recipes];
  }

  /** Filter mit dem Suchbegriff auf Englisch (KI, sonst Wörterbuch); die Datenbank kennt nur Englisch. */
  private async englishFilters(): Promise<OnlineSearchFilters> {
    const filters = this.filters();
    const { query } = await this.translator.translateQuery(filters.query);
    return { ...filters, query };
  }

  async search(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.provider.search(await this.englishFilters());
      this.results.set(this.visible(page.recipes));
      this.fetched.set(page.recipes.length);
      this.total.set(page.totalResults);
    } catch (e: unknown) {
      this.results.set([]);
      this.fetched.set(0);
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
      const page = await this.provider.search(await this.englishFilters(), this.fetched());
      this.results.update((list) => [...list, ...this.visible(page.recipes).filter((r) => !list.some((o) => o.id === r.id))]);
      this.fetched.update((n) => n + page.recipes.length);
      // Leere Seite: es kommt nichts mehr, das Nachladen endet.
      this.total.set(page.recipes.length === 0 ? this.fetched() : page.totalResults);
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

  private async ensureTranslation(): Promise<void> {
    const sel = this.selected();
    if (!sel || this.translations().has(sel.id)) return;
    this.translating.set(true);
    try {
      const translated = await this.translator.translate(sel);
      this.translations.update((m) => new Map(m).set(sel.id, translated));
    } finally {
      this.translating.set(false);
    }
  }

  /** Speichert das Rezept in der App-Sprache (wartet auf eine laufende Übersetzung). */
  async save(): Promise<void> {
    await this.ensureTranslation();
    const recipe = this.shown();
    const sel = this.selected();
    if (!recipe || !sel || this.isSaved()) return;
    this.recipeStore.add(toRecipeDraft(recipe));
    this.savedIds.update((s) => new Set(s).add(sel.id));
    this.toast.set('Rezept gespeichert. Du findest es in deiner Rezeptliste.');
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

  /** Menge im gewählten Einheitensystem. */
  amountText(amount: number, unit: string, name = ''): string {
    return amount > 0 ? formatQuantity(amount, unit, name, this.settings.unitSystem()) : unit;
  }

  stepText(step: string): string {
    return convertStepText(step, this.settings.unitSystem());
  }

  onToastDismiss(): void {
    this.toast.set(null);
  }
}
