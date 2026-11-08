import { Injectable, inject } from '@angular/core';
import { MealType } from '../models';
import { RecipeSearchAccessService } from '../recipes/online/recipe-search-access';
import { ONLINE_SEARCH_MESSAGES, OnlineSearchError, toOnlineSearchError } from '../recipes/online/spoonacular.errors';
import { SpoonacularProvider } from '../recipes/online/spoonacular.provider';
import { ProfileStore } from '../state/profile.store';
import { ShoppingStore } from '../state/shopping.store';
import { WeekPlanStore } from '../state/week-plan.store';
import { makeId } from '../util/id';
import { WeekPlanDraft, buildWeekPlanRecipes } from './week-plan-builder';
import { WeekPlan } from './week-plan.model';

export const NO_RECIPES_FOUND_MESSAGE = 'Keine passenden Rezepte gefunden. Versuche es später oder mit weniger Mahlzeiten.';

export interface WeekPlanOptions {
  persons: number;
  days: number;
  meals: MealType[];
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
      });
    } catch (e: unknown) {
      throw toOnlineSearchError(e, typeof navigator !== 'undefined' && navigator.onLine === false);
    }
    if (draft.recipes.length === 0) throw new Error(NO_RECIPES_FOUND_MESSAGE);
    const plan: WeekPlan = {
      id: makeId('week'),
      generatedAt: new Date().toISOString(),
      persons: opts.persons,
      days: opts.days,
      meals: opts.meals,
      recipes: draft.recipes,
      notices: draft.notices,
    };
    this.planStore.set(plan);
    const list = this.shopping.applyWeekPlan(plan);
    return { plan, itemCount: list.items.length };
  }
}
