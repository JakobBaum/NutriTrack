import { signal } from '@angular/core';
import { Recipe } from '../core/models';
import { OnlineRecipeDetailsService } from '../core/recipes/online/online-recipe-details.service';
import { StoredRecipe, isOnlineRef } from '../core/recipes/online/online-recipe-ref';
import { OnlineSearchError, OnlineSearchFailure } from '../core/recipes/online/spoonacular.errors';
import { RequestGuard } from './request-guard';

export const ONLINE_LOAD_FAILED_MESSAGE = 'Das Rezept konnte nicht geladen werden. Versuche es erneut.';

/** Zustand beim Nachladen eines gespeicherten Online-Verweises. */
export type OnlineLoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly reason: OnlineSearchFailure | 'unknown'; readonly message: string };

/** Fehlergrund und deutsche Meldung zu einem beliebigen Fehler beim Nachladen. */
export function describeLoadError(e: unknown): { reason: OnlineSearchFailure | 'unknown'; message: string } {
  return e instanceof OnlineSearchError
    ? { reason: e.reason, message: e.message }
    : { reason: 'unknown', message: ONLINE_LOAD_FAILED_MESSAGE };
}

/**
 * Lädt die Details eines Online-Verweises und hält Laden/Fehler fest. Nur die jüngste Anfrage gilt:
 * Schließen oder ein neuer Aufruf verwirft ältere Antworten.
 */
export class OnlineDetailLoader {
  readonly state = signal<OnlineLoadState>({ kind: 'idle' });
  private readonly guard = new RequestGuard();

  constructor(private readonly details: OnlineRecipeDetailsService) {}

  /** Volles Rezept; `null` bei Fehler (siehe `state`) oder wenn die Antwort veraltet ist. Eigene Rezepte kommen sofort zurück. */
  async load(recipe: StoredRecipe): Promise<Recipe | null> {
    if (!isOnlineRef(recipe)) return recipe;
    const token = this.guard.begin();
    this.state.set({ kind: 'loading' });
    try {
      const full = await this.details.resolve(recipe);
      if (!this.guard.isCurrent(token)) return null;
      this.state.set({ kind: 'idle' });
      return full;
    } catch (e: unknown) {
      if (this.guard.isCurrent(token)) this.state.set({ kind: 'error', ...describeLoadError(e) });
      return null;
    }
  }

  /** Verwirft laufende Anfragen und setzt den Zustand zurück. */
  cancel(): void {
    this.guard.cancel();
    this.state.set({ kind: 'idle' });
  }
}
