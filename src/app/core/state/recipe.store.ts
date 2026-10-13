import { Injectable, inject, signal } from '@angular/core';
import { Recipe } from '../models';
import { StorageService } from '../storage/storage.service';
import { makeId } from '../util/id';

const KEY_RECIPES = 'recipes';

/** Felder zum Anlegen/Bearbeiten eines Rezepts (ohne System-Felder). */
export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Verwaltet eigene und importierte Rezepte offline-first.
 * Nährwerte je Portion werden im MVP manuell erfasst; der KI-Import
 * (URL/TikTok/Foto) wird später über den AiProvider ergänzt.
 */
@Injectable({ providedIn: 'root' })
export class RecipeStore {
  private readonly storage = inject(StorageService);

  private readonly _recipes = signal<Recipe[]>(
    this.storage.get<Recipe[]>(KEY_RECIPES, []),
  );

  /** Alle Rezepte, neueste zuerst. */
  readonly recipes = this._recipes.asReadonly();

  /** Einzelnes Rezept nach ID. */
  get(id: string): Recipe | undefined {
    return this._recipes().find((r) => r.id === id);
  }

  /** Legt ein neues Rezept an. */
  add(draft: RecipeDraft): Recipe {
    const now = new Date().toISOString();
    const recipe: Recipe = { ...draft, id: makeId('recipe'), createdAt: now, updatedAt: now };
    this._recipes.update((list) => [recipe, ...list]);
    this.persist();
    return recipe;
  }

  /** Aktualisiert ein bestehendes Rezept (immutable). */
  update(id: string, draft: RecipeDraft): void {
    this._recipes.update((list) =>
      list.map((r) =>
        r.id === id ? { ...r, ...draft, updatedAt: new Date().toISOString() } : r,
      ),
    );
    this.persist();
  }

  /** Entfernt ein Rezept. */
  remove(id: string): void {
    this._recipes.update((list) => list.filter((r) => r.id !== id));
    this.persist();
  }

  /** Löscht alle Rezepte (für "Daten zurücksetzen"). */
  clear(): void {
    this._recipes.set([]);
    this.persist();
  }

  private persist(): void {
    this.storage.set(KEY_RECIPES, this._recipes());
  }
}
