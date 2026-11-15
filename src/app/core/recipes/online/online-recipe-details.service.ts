import { Injectable, inject, signal } from '@angular/core';
import { Recipe } from '../../models';
import { RecipeTranslateService } from '../translate/recipe-translate';
import { OnlineRecipe } from './online-recipe.model';
import { StoredRecipe, isOnlineRef } from './online-recipe-ref';
import { OnlineSearchError } from './spoonacular.errors';
import { SpoonacularProvider } from './spoonacular.provider';

/** Spoonacular-Bedingungen: Zwischenspeicher höchstens 1 Stunde (wie der Worker-Cache), nur im Arbeitsspeicher. */
export const ONLINE_RECIPE_TTL_MS = 60 * 60 * 1000;

export const ONLINE_RECIPE_OFFLINE_MESSAGE = 'Dieses Rezept stammt von Spoonacular und braucht eine Internetverbindung.';

/** Höchstens so viele Details werden gleichzeitig geladen (schont Kontingent und Netz). */
export const RESOLVE_ALL_CONCURRENCY = 3;

/** Ergebnis je Rezept bei {@link OnlineRecipeDetailsService.resolveAll}: aufgelöst oder Fehler, immer mit dem Ausgangsrezept. */
export type ResolveOutcome =
  | { readonly ok: true; readonly source: StoredRecipe; readonly recipe: Recipe }
  | { readonly ok: false; readonly source: StoredRecipe; readonly error: unknown };

interface CacheEntry {
  readonly recipe: OnlineRecipe;
  readonly at: number;
}

/** Volles Rezept (nur im Arbeitsspeicher) aus den geladenen Details und dem gespeicherten Verweis. */
function toFullRecipe(online: OnlineRecipe, stored: Pick<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Recipe {
  return {
    id: stored.id,
    title: online.title,
    servings: online.servings,
    ingredients: online.ingredients,
    steps: online.steps,
    origin: 'online',
    ...(online.sourceUrl ? { sourceUrl: online.sourceUrl } : {}),
    ...(online.imageUrl ? { imageUrl: online.imageUrl } : {}),
    ...(online.facts ? { factsPerServing: online.facts } : {}),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/**
 * Lädt die Details gespeicherter Online-Verweise über den {@link SpoonacularProvider} nach (Einwilligung und
 * Fehlerbilder kommen von dort). Ergebnisse liegen höchstens eine Stunde im Arbeitsspeicher, nie im Speicher.
 */
@Injectable({ providedIn: 'root' })
export class OnlineRecipeDetailsService {
  private readonly provider = inject(SpoonacularProvider);
  private readonly translator = inject(RecipeTranslateService);

  private readonly cache = signal<ReadonlyMap<string, CacheEntry>>(new Map());
  private readonly inflight = new Map<string, Promise<OnlineRecipe>>();

  /** Geladene (noch gültige) Details; liest ein Signal, damit Karten nach dem Laden Werte zeigen. */
  peek(externalId: string): OnlineRecipe | undefined {
    const hit = this.cache().get(externalId);
    return hit && Date.now() - hit.at <= ONLINE_RECIPE_TTL_MS ? hit.recipe : undefined;
  }

  /** Volles Rezept für ein gespeichertes Rezept: Verweise werden nachgeladen, eigene Rezepte unverändert zurückgegeben. */
  async resolve(recipe: StoredRecipe): Promise<Recipe> {
    if (!isOnlineRef(recipe)) return recipe;
    return toFullRecipe(await this.load(recipe.onlineRef.externalId), recipe);
  }

  /**
   * Löst alle Verweise parallel (begrenzt) auf. Kein Alles-oder-nichts: jedes Rezept liefert Erfolg oder
   * Fehler, die Reihenfolge bleibt erhalten, eigene Rezepte kommen unverändert zurück.
   */
  async resolveAll(recipes: readonly StoredRecipe[]): Promise<ResolveOutcome[]> {
    const outcomes: ResolveOutcome[] = new Array(recipes.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < recipes.length) {
        const index = next++;
        outcomes[index] = await this.settle(recipes[index]);
      }
    };
    const workers = Math.min(RESOLVE_ALL_CONCURRENCY, recipes.length);
    await Promise.all(Array.from({ length: workers }, worker));
    return outcomes;
  }

  private async settle(source: StoredRecipe): Promise<ResolveOutcome> {
    try {
      return { ok: true, source, recipe: await this.resolve(source) };
    } catch (error: unknown) {
      return { ok: false, source, error };
    }
  }

  /** Details eines Online-Rezepts: Zwischenspeicher, sonst eine (gemeinsame) Anfrage. */
  load(externalId: string): Promise<OnlineRecipe> {
    const cached = this.peek(externalId);
    if (cached) return Promise.resolve(cached);
    const running = this.inflight.get(externalId);
    if (running) return running;
    const work = this.fetch(externalId).finally(() => this.inflight.delete(externalId));
    this.inflight.set(externalId, work);
    return work;
  }

  private async fetch(externalId: string): Promise<OnlineRecipe> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw this.offlineError();
    try {
      const translated = await this.translator.translate(await this.provider.getRecipe(externalId));
      const now = Date.now();
      this.cache.update((m) => new Map([...m].filter(([, e]) => now - e.at <= ONLINE_RECIPE_TTL_MS)).set(externalId, { recipe: translated, at: now }));
      return translated;
    } catch (e: unknown) {
      throw e instanceof OnlineSearchError && e.reason === 'offline' ? this.offlineError() : e;
    }
  }

  private offlineError(): OnlineSearchError {
    return new OnlineSearchError('offline', ONLINE_RECIPE_OFFLINE_MESSAGE);
  }
}
