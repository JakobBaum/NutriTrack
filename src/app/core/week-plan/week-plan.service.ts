import { Injectable, inject, signal } from '@angular/core';
import { MealType } from '../models';
import { RecipeTranslateService } from '../recipes/translate/recipe-translate';
import { RecipeSearchAccessService } from '../recipes/online/recipe-search-access';
import { ONLINE_SEARCH_MESSAGES, OnlineSearchError, toOnlineSearchError } from '../recipes/online/spoonacular.errors';
import { SpoonacularProvider } from '../recipes/online/spoonacular.provider';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { ProfileStore } from '../state/profile.store';
import { ShoppingStore } from '../state/shopping.store';
import { WeekPlanStore } from '../state/week-plan.store';
import { makeId } from '../util/id';
import { WeekPlanDraft, buildWeekPlanRecipes } from './week-plan-builder';
import { WeekPlan } from './week-plan.model';

export const NO_RECIPES_FOUND_MESSAGE = 'Keine passenden Rezepte gefunden. Versuche es später oder mit weniger Essenszeiten.';

export const NO_REPLACEMENT_FOUND_MESSAGE = 'Kein anderes passendes Rezept gefunden. Versuche es später noch einmal.';
/** Beim Tauschen mehr Treffer anfragen, damit nach dem Ausschließen noch Auswahl bleibt. */
const REPLACE_REQUEST_FLOOR = 10;

export interface WeekPlanOptions {
  persons: number;
  days: number;
  meals: MealType[];
  /** false: bisherige Einkaufsliste komplett ersetzen (Standard: abgehakte und eigene Positionen behalten). */
  keepExisting?: boolean;
}

export interface WeekPlanResult {
  plan: WeekPlan;
  /** Positionen der Einkaufsliste nach dem Zusammenführen. */
  itemCount: number;
}

/**
 * Erstellt den Wochenplan aus Online-Rezepten (spoonacular, über eigenen Key oder den globalen
 * Worker), speichert ihn und schreibt alle Zutaten in die Einkaufsliste.
 */
@Injectable({ providedIn: 'root' })
export class WeekPlanService {
  private readonly provider = inject(SpoonacularProvider);
  private readonly access = inject(RecipeSearchAccessService);
  private readonly profile = inject(ProfileStore);
  private readonly planStore = inject(WeekPlanStore);
  private readonly shopping = inject(ShoppingStore);
  private readonly translator = inject(RecipeTranslateService);
  private readonly _progress = signal<{ done: number; total: number } | null>(null);
  private ensuring: Promise<void> | null = null;
  /** Pläne, die in dieser Sitzung schon nachübersetzt wurden (kein erneutes KI-Hämmern bei Fehlern). */
  private readonly attempted = new Set<string>();

  /** Fortschritt der Übersetzung ("Übersetze Rezepte (n/m)"), sonst null. */
  readonly translateProgress = this._progress.asReadonly();

  /** Ob die Online-Suche erreichbar konfiguriert ist (eigener Key oder globaler Worker). */
  isAvailable(): boolean {
    return this.access.isAvailable();
  }

  /**
   * Wirft {@link OnlineSearchError} mit deutscher Meldung (nicht eingerichtet, Limit, offline, Timeout …)
   * bzw. einen Error ohne Treffer. Bei Fehlern bleiben Plan und Liste unverändert.
   */
  async generate(opts: WeekPlanOptions): Promise<WeekPlanResult> {
    if (!this.access.isAvailable()) throw new OnlineSearchError('no-key', ONLINE_SEARCH_MESSAGES['no-key']);
    const target = this.profile.target();
    let draft: WeekPlanDraft;
    try {
      draft = await buildWeekPlanRecipes((f, o, n) => this.provider.search(f, o, n), {
        persons: opts.persons,
        days: opts.days,
        meals: opts.meals,
        dailyKcal: target?.kcal ?? null,
        dailyProteinG: target?.proteinG ?? null,
        excludeIds: this.planStore.blocked(),
      });
    } catch (e: unknown) {
      throw toOnlineSearchError(e, typeof navigator !== 'undefined' && navigator.onLine === false);
    }
    if (draft.recipes.length === 0) throw new Error(NO_RECIPES_FOUND_MESSAGE);
    const recipes = await this.translateRecipes(draft.recipes);
    const plan: WeekPlan = {
      id: makeId('week'),
      generatedAt: new Date().toISOString(),
      persons: opts.persons,
      days: opts.days,
      meals: opts.meals,
      recipes,
      notices: draft.notices,
    };
    this.planStore.set(plan);
    const list = this.shopping.applyWeekPlan(plan, opts.keepExisting ?? true);
    return { plan, itemCount: list.items.length };
  }

  /**
   * Entfernt ein Rezept aus dem Plan und schreibt die Einkaufsliste neu (abgehakte/eigene Positionen bleiben).
   * Mit `neverAgain` wird es auch bei künftigen Plänen nicht mehr vorgeschlagen.
   */
  removeRecipe(recipeId: string, neverAgain: boolean): void {
    const plan = this.planStore.plan();
    if (!plan?.recipes.some((r) => r.id === recipeId)) return;
    if (neverAgain) this.planStore.block([recipeId]);
    const next: WeekPlan = { ...plan, recipes: plan.recipes.filter((r) => r.id !== recipeId) };
    this.planStore.set(next);
    this.shopping.applyWeekPlan(next);
  }

  /**
   * Tauscht ein Rezept gegen ein neues derselben Mahlzeit (gleiche Eiweiß-/Kalorienvorgaben), ohne Duplikate
   * und ohne gesperrte Rezepte. Bei Fehlern bleibt alles unverändert; das alte wird erst nach Erfolg gesperrt.
   */
  async replaceRecipe(recipeId: string, neverAgain: boolean): Promise<void> {
    if (!this.access.isAvailable()) throw new OnlineSearchError('no-key', ONLINE_SEARCH_MESSAGES['no-key']);
    const plan = this.planStore.plan();
    const old = plan?.recipes.find((r) => r.id === recipeId);
    if (!plan || !old) return;
    const target = this.profile.target();
    let draft: WeekPlanDraft;
    try {
      draft = await buildWeekPlanRecipes((f, o, n) => this.provider.search(f, o, n), {
        persons: plan.persons,
        days: 1,
        meals: [old.meal],
        dailyKcal: target?.kcal ?? null,
        dailyProteinG: target?.proteinG ?? null,
        excludeIds: [...this.planStore.blocked(), ...plan.recipes.map((r) => r.id)],
        requestFloor: REPLACE_REQUEST_FLOOR,
      });
    } catch (e: unknown) {
      throw toOnlineSearchError(e, typeof navigator !== 'undefined' && navigator.onLine === false);
    }
    if (draft.recipes.length === 0) throw new Error(NO_REPLACEMENT_FOUND_MESSAGE);
    const [fresh] = await this.translateRecipes(draft.recipes.slice(0, 1));
    // Plan kann sich während der Suche geändert haben: auf dem aktuellen Stand ersetzen.
    const current = this.planStore.plan();
    if (!current?.recipes.some((r) => r.id === recipeId)) return;
    if (neverAgain) this.planStore.block([recipeId]);
    const next: WeekPlan = { ...current, recipes: current.recipes.map((r) => (r.id === recipeId ? fresh : r)) };
    this.planStore.set(next);
    this.shopping.applyWeekPlan(next);
  }

  /**
   * Übersetzt Rezepte eines bereits gespeicherten Plans nach (z. B. aus älteren Versionen) und schreibt die Einkaufsliste
   * mit den deutschen Zutatennamen neu. Läuft nie doppelt; ohne Plan oder bei fertiger Übersetzung passiert nichts.
   */
  ensureTranslated(): Promise<void> {
    if (this.ensuring) return this.ensuring;
    const plan = this.planStore.plan();
    if (!plan || this.attempted.has(plan.id) || !plan.recipes.some((r) => this.translator.needsTranslation(r))) return Promise.resolve();
    this.attempted.add(plan.id);
    const job = this.retranslate(plan).finally(() => {
      this.ensuring = null;
    });
    this.ensuring = job;
    return job;
  }

  /** „Erneut übersetzen“: hebt die Sperre der Sitzung für den aktuellen Plan auf und übersetzt noch einmal. */
  retryTranslation(): Promise<void> {
    const plan = this.planStore.plan();
    if (!plan) return Promise.resolve();
    this.attempted.delete(plan.id);
    return this.ensureTranslated();
  }

  private async retranslate(plan: WeekPlan): Promise<void> {
    const translated = new Map((await this.translateRecipes(plan.recipes)).map((r) => [r.id, r]));
    // Die Übersetzung dauert; der Plan kann inzwischen geändert oder ersetzt worden sein. Nur in den aktuellen Stand mischen.
    const current = this.planStore.plan();
    if (current?.id !== plan.id) return;
    const next: WeekPlan = { ...current, recipes: current.recipes.map((r) => translated.get(r.id) ?? r) };
    this.planStore.set(next);
    this.shopping.applyWeekPlan(next);
  }

  private async translateRecipes<T extends OnlineRecipe>(recipes: readonly T[]): Promise<T[]> {
    try {
      return await this.translator.translateAll(recipes, (done, total) => this._progress.set({ done, total }));
    } finally {
      this._progress.set(null);
    }
  }
}
