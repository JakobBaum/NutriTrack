import { inject, signal } from '@angular/core';
import { DebugLogService } from '../core/debug/debug-log.service';
import { NutritionFacts, Recipe } from '../core/models';
import { OnlineRecipeDetailsService } from '../core/recipes/online/online-recipe-details.service';
import { StoredRecipe, isOnlineRef } from '../core/recipes/online/online-recipe-ref';
import { describeLoadError } from '../recipes/online-detail-loader';
import { RequestGuard } from '../recipes/request-guard';

/** Mehr als diese Energie je Portion ist für ein Rezept nicht plausibel (Fehler der Quelle). */
const MAX_KCAL_PER_SERVING = 4000;
/** Mehr als diese Menge eines Makros je Portion ist nicht plausibel. */
const MAX_MACRO_G_PER_SERVING = 400;

export const NO_FACTS_MESSAGE = 'Für dieses Rezept gibt es keine Nährwerte.';
export const IMPLAUSIBLE_FACTS_MESSAGE = 'Die Nährwerte dieses Rezepts sind nicht plausibel und werden nicht übernommen.';

/** Zustand beim Nachladen der Nährwerte eines Rezepts. */
export type FactsLoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly title: string }
  | { readonly kind: 'error'; readonly message: string; readonly recipe: StoredRecipe };

/** Nährwerte je Portion mit dem (ggf. nachgeladenen) vollen Rezept. */
export interface LoadedRecipeFacts {
  readonly recipe: Recipe;
  readonly facts: NutritionFacts;
}

const isNonNegativeUpTo = (value: number | undefined, max: number): boolean =>
  value === undefined || (Number.isFinite(value) && value >= 0 && value <= max);

/** Harte Grenzen für nachgeladene Nährwerte je Portion (der Mapper prüft nur auf Zahlen, nicht auf Größenordnung). */
export function isPlausibleServingFacts(f: NutritionFacts): boolean {
  const macros = [f.proteinG, f.carbsG, f.fatG, f.fiberG, f.sugarG, f.saltG];
  return isNonNegativeUpTo(f.kcal, MAX_KCAL_PER_SERVING) && macros.every((g) => isNonNegativeUpTo(g, MAX_MACRO_G_PER_SERVING));
}

/**
 * Liefert die Nährwerte je Portion eines gespeicherten Rezepts: Verweise werden nachgeladen und geprüft,
 * Laden und Fehler stehen in `state`. Nur die jüngste Anfrage gilt (Sequenz-Token).
 */
export class RecipeFactsLoader {
  readonly state = signal<FactsLoadState>({ kind: 'idle' });
  private readonly guard = new RequestGuard();

  constructor(
    private readonly details: OnlineRecipeDetailsService,
    /** Standard: DebugLogService (nur im Injektionskontext, z. B. als Feld-Initialisierer). */
    private readonly log: { error(msg: string): void } = inject(DebugLogService),
  ) {}

  /** Werte des Rezepts; `null` bei Fehler (siehe `state`), fehlenden Werten oder veralteter Antwort. */
  async load(stored: StoredRecipe): Promise<LoadedRecipeFacts | null> {
    const token = this.guard.begin();
    if (!isOnlineRef(stored)) return this.ownFacts(token, stored);
    this.state.set({ kind: 'loading', title: stored.title });
    try {
      return this.checkLoaded(token, stored, await this.details.resolve(stored));
    } catch (e: unknown) {
      this.log.error(`Rezeptdetails „${stored.title}“ nicht geladen: ${e instanceof Error ? e.message : String(e)}`);
      this.fail(token, describeLoadError(e).message, stored);
      return null;
    }
  }

  /** Verwirft laufende Anfragen und setzt den Zustand zurück. */
  cancel(): void {
    this.guard.cancel();
    this.state.set({ kind: 'idle' });
  }

  /** Eigene Rezepte (nur mit Werten wählbar) kommen ohne Laden und ohne Fehlerbanner zurück. */
  private ownFacts(token: number, recipe: Recipe): LoadedRecipeFacts | null {
    this.state.set({ kind: 'idle' });
    if (!this.guard.isCurrent(token) || !recipe.factsPerServing) return null;
    return { recipe, facts: recipe.factsPerServing };
  }

  private checkLoaded(token: number, stored: StoredRecipe, full: Recipe): LoadedRecipeFacts | null {
    if (!this.guard.isCurrent(token)) return null;
    const facts = full.factsPerServing;
    if (!facts) return this.fail(token, NO_FACTS_MESSAGE, stored);
    if (!isPlausibleServingFacts(facts)) return this.fail(token, IMPLAUSIBLE_FACTS_MESSAGE, stored);
    this.state.set({ kind: 'idle' });
    return { recipe: full, facts };
  }

  private fail(token: number, message: string, recipe: StoredRecipe): null {
    if (this.guard.isCurrent(token)) this.state.set({ kind: 'error', message, recipe });
    return null;
  }
}
