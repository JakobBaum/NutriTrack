import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AiService } from '../ai/ai.service';
import { Recipe } from '../models';
import { OnlineRecipeDetailsService, ResolveOutcome } from '../recipes/online/online-recipe-details.service';
import { StoredRecipe } from '../recipes/online/online-recipe-ref';
import { OnlineSearchError } from '../recipes/online/spoonacular.errors';
import { RecipeStore } from './recipe.store';
import { ShoppingStore } from './shopping.store';

const REF = { source: 'spoonacular', externalId: '77', savedAt: '2026-01-01T00:00:00.000Z' } as const;

function setup(isLive: boolean, resolveAll: (r: readonly StoredRecipe[]) => Promise<ResolveOutcome[]>, generate: () => Promise<unknown> = () => Promise.reject(new Error('offline-ki'))) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: AiService, useValue: { isLive: () => isLive, generateShoppingList: generate } },
      { provide: OnlineRecipeDetailsService, useValue: { resolveAll } },
    ],
  });
  const recipes = TestBed.inject(RecipeStore);
  recipes.add({ title: 'Linsensuppe', servings: 1, ingredients: [], steps: [], origin: 'online', onlineRef: REF });
  return { store: TestBed.inject(ShoppingStore), recipes };
}

const full = (source: StoredRecipe): Recipe => ({
  ...source, servings: 2, ingredients: [{ name: 'Linsen', amount: 200, unit: 'g' }], steps: ['Kochen.'],
});
const okAll = async (list: readonly StoredRecipe[]): Promise<ResolveOutcome[]> =>
  list.map((source) => ({ ok: true, source, recipe: full(source) }));

describe('ShoppingStore.generatePlan mit Online-Verweisen', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('löst Verweise ohne KI vor der Planung auf, die Zutaten landen in der Liste', async () => {
    const { store } = setup(false, okAll);

    const list = await store.generatePlan({ persons: 2, days: 1, meals: ['dinner'] });

    expect(list.items.some((i) => i.name.toLowerCase().includes('linsen'))).toBe(true);
    expect(list.note).toBeUndefined();
  });

  it('erstellt den Plan mit den übrigen Rezepten und nennt ausgelassene beim Titel', async () => {
    const failing = async (l: readonly StoredRecipe[]): Promise<ResolveOutcome[]> =>
      l.map((source): ResolveOutcome => source.onlineRef
        ? { ok: false, source, error: new OnlineSearchError('offline', 'kein Netz') }
        : { ok: true, source, recipe: source });
    const { store, recipes } = setup(false, failing);
    recipes.add({ title: 'Reis', servings: 1, steps: [], origin: 'own', ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }] });

    const list = await store.generatePlan({ persons: 1, days: 1, meals: ['dinner'] });

    expect(list.items.some((i) => i.name === 'Reis')).toBe(true);
    expect(list.notice).toBe('Nicht geladen: Linsensuppe');
  });

  it('wirft einen klaren Fehler, wenn kein einziges Rezept geladen werden konnte', async () => {
    const failing = async (l: readonly StoredRecipe[]): Promise<ResolveOutcome[]> =>
      l.map((source) => ({ ok: false, source, error: new Error('x') }));
    const { store } = setup(false, failing);

    await expect(store.generatePlan({ persons: 1, days: 1, meals: ['dinner'] })).rejects.toThrow('Nicht geladen: Linsensuppe');
    expect(store.list()).toBeNull();
  });

  it('lädt mit KI nichts nach (der Worker bekommt nur Titel)', async () => {
    const resolveAll = vi.fn(okAll);
    const generate = vi.fn(async () => ({ items: [], suggestedDishes: [], estTotal: 0 }));
    const { store } = setup(true, resolveAll, generate);

    const list = await store.generatePlan({ persons: 1, days: 1, meals: ['dinner'] });

    expect(resolveAll).not.toHaveBeenCalled();
    expect(list.note).toBeUndefined();
  });
});
