import { Injectable, inject, signal } from '@angular/core';
import { Recipe } from '../models';
import { StorageService } from '../storage/storage.service';
import { makeId } from '../util/id';
import { AUTO_SNAPSHOT_KEY } from '../backup/backup';
import { buildSafetySnapshot } from '../backup/backup-safety';
import { sanitizeRecipes } from './recipe-sanitize';
import { OnlineRecipeRef, StoredRecipe, isOnlineRef, migrateOnlineRecipes, toRefRecord } from '../recipes/online/online-recipe-ref';

const KEY_RECIPES = 'recipes';

/** Zutatenmengen: negative oder nicht endliche Werte werden 0 (= ohne Menge). */
function withSafeAmounts(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((i) => ({
      ...i,
      amount: typeof i.amount === 'number' && Number.isFinite(i.amount) && i.amount > 0 ? i.amount : 0,
    })),
  };
}

/**
 * Felder zum Anlegen/Bearbeiten eines Rezepts (ohne System-Felder). Mit `onlineRef` wird nur der Verweis
 * auf ein Online-Rezept gespeichert (Zutaten, Schritte und Nährwerte werden verworfen).
 */
export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { onlineRef?: OnlineRecipeRef };

/**
 * Verwaltet eigene und importierte Rezepte offline-first.
 * Nährwerte je Portion werden im MVP manuell erfasst; der KI-Import
 * (URL/TikTok/Foto) wird später über den AiProvider ergänzt.
 */
@Injectable({ providedIn: 'root' })
export class RecipeStore {
  private readonly storage = inject(StorageService);
  /** True, wenn Schreiben gesperrt ist (neueres Schema oder Änderung in anderem Fenster); Änderungen werden dann nicht gespeichert. */
  readonly isReadOnly = this.storage.isLockedFor(KEY_RECIPES);

  private readonly _recipes = signal<StoredRecipe[]>(this.load());

  /** Alle Rezepte, neueste zuerst. */
  readonly recipes = this._recipes.asReadonly();

  /** Einzelnes Rezept nach ID. */
  get(id: string): StoredRecipe | undefined {
    return this._recipes().find((r) => r.id === id);
  }

  /** Gespeicherter Verweis auf ein Online-Rezept mit dieser Anbieter-Id. */
  findOnline(externalId: string): StoredRecipe | undefined {
    return this._recipes().find((r) => isOnlineRef(r) && r.onlineRef.externalId === externalId);
  }

  /** Legt ein neues Rezept an; Online-Rezepte nur als Verweis. */
  add(draft: RecipeDraft): StoredRecipe {
    const now = new Date().toISOString();
    const { onlineRef, ...rest } = draft;
    const base: Recipe = { ...withSafeAmounts(rest), id: makeId('recipe'), createdAt: now, updatedAt: now };
    const recipe: StoredRecipe = onlineRef ? toRefRecord(base, onlineRef) : base;
    this._recipes.update((list) => [recipe, ...list]);
    this.persist();
    return recipe;
  }

  /** Aktualisiert ein bestehendes Rezept (immutable). Ein bearbeiteter Online-Verweis wird zum eigenen, vollständigen Rezept. */
  update(id: string, draft: RecipeDraft): void {
    const { onlineRef: _ignored, ...rest } = draft;
    this._recipes.update((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const { onlineRef: _old, ...kept } = r;
        return { ...kept, ...withSafeAmounts(rest), updatedAt: new Date().toISOString() };
      }),
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

  /** Lädt die Rezepte; vollständig gespeicherte Spoonacular-Rezepte werden einmalig auf den Verweis reduziert. */
  private load(): StoredRecipe[] {
    const loaded = this.storage
      .getSanitized<StoredRecipe>(KEY_RECIPES, sanitizeRecipes)
      .map((r) => ({ ...r, steps: r.steps ?? [], ingredients: r.ingredients ?? [] }));
    return this.migrateOnline(loaded);
  }

  /** Reduziert alte Online-Rezepte erst nach geglückter Auto-Sicherung; bei neuerem Schema oder ohne Sicherung bleibt alles unverändert. */
  private migrateOnline(loaded: StoredRecipe[]): StoredRecipe[] {
    if (this.storage.schemaNewer()) return loaded;
    const { recipes, changed } = migrateOnlineRecipes(loaded);
    if (!changed || !this.saveMigrationSnapshot()) return loaded;
    this.storage.set(KEY_RECIPES, recipes);
    return recipes;
  }

  /** Legt den vollen Stand als Auto-Sicherung ab (die Reduktion ist verlustbehaftet). */
  private saveMigrationSnapshot(): boolean {
    const snapshot = buildSafetySnapshot(this.storage.snapshot(), 'migration', new Date());
    return snapshot !== null && this.storage.set(AUTO_SNAPSHOT_KEY, snapshot) && this.storage.flush();
  }

  private persist(): boolean {
    return this.storage.set(KEY_RECIPES, this._recipes());
  }
}
