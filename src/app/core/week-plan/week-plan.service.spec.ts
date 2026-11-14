import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RecipeSearchAccessService } from '../recipes/online/recipe-search-access';
import { OnlineSearchError } from '../recipes/online/spoonacular.errors';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { SpoonacularProvider } from '../recipes/online/spoonacular.provider';
import { ProfileStore } from '../state/profile.store';
import { ShoppingStore } from '../state/shopping.store';
import { WeekPlanStore } from '../state/week-plan.store';
import { NO_RECIPES_FOUND_MESSAGE, WeekPlanService } from './week-plan.service';

const recipe = (id: string): OnlineRecipe => ({
  id, title: `Rezept ${id}`, servings: 2, steps: ['x'],
  ingredients: [{ name: `Zutat ${id}`, amount: 100, unit: 'g' }, { name: 'Salz', amount: 1, unit: 'g' }],
});

function setup(search: ReturnType<typeof vi.fn>, available = true): WeekPlanService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: SpoonacularProvider, useValue: { search } },
      { provide: RecipeSearchAccessService, useValue: { isAvailable: () => available } },
    ],
  });
  return TestBed.inject(WeekPlanService);
}

const OPTS = { persons: 2, days: 2, meals: ['dinner' as const] };

describe('WeekPlanService.generate', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('stores the plan, fills the shopping list and reports the item count', async () => {
    const search = vi.fn().mockResolvedValue({ recipes: [recipe('1'), recipe('2')], totalResults: 2, quotaLeft: null });
    const service = setup(search);

    const { plan, itemCount } = await service.generate(OPTS);

    expect(plan.recipes).toHaveLength(2);
    expect(TestBed.inject(WeekPlanStore).plan()?.id).toBe(plan.id);
    expect(itemCount).toBe(TestBed.inject(ShoppingStore).list()?.items.length);
    expect(itemCount).toBeGreaterThanOrEqual(3);
  });

  it('reicht Ernährungsform, Unverträglichkeiten und Abneigungen aus dem Profil an die Suche', async () => {
    const search = vi.fn().mockResolvedValue({ recipes: [recipe('1'), recipe('2')], totalResults: 2, quotaLeft: null });
    const service = setup(search);
    TestBed.inject(ProfileStore).setProfile({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '',
      diet: 'vegetarian', intolerances: ['gluten'], dislikes: ['Pilze'], dislikesEn: ['mushrooms'],
    });

    await service.generate(OPTS);

    expect(search.mock.calls[0][0]).toMatchObject({ diet: 'vegetarian', intolerances: ['gluten'], excludeIngredients: ['mushrooms'] });
  });

  it('throws the "not set up" error without any request when online search is unavailable', async () => {
    const search = vi.fn();
    const service = setup(search, false);

    await expect(service.generate(OPTS)).rejects.toMatchObject({ reason: 'no-key' });
    expect(search).not.toHaveBeenCalled();
    expect(TestBed.inject(WeekPlanStore).plan()).toBeNull();
  });

  it.each(['quota', 'offline', 'timeout', 'rate-limit'] as const)('keeps plan and list untouched on a %s error', async (reason) => {
    const search = vi.fn().mockRejectedValue(new OnlineSearchError(reason, `Fehler ${reason}`));
    const service = setup(search);

    await expect(service.generate(OPTS)).rejects.toMatchObject({ reason, message: `Fehler ${reason}` });
    expect(TestBed.inject(WeekPlanStore).plan()).toBeNull();
    expect(TestBed.inject(ShoppingStore).list()).toBeNull();
  });

  it('maps unknown errors to a friendly message', async () => {
    const service = setup(vi.fn().mockRejectedValue(new Error('boom')));

    await expect(service.generate(OPTS)).rejects.toBeInstanceOf(OnlineSearchError);
  });

  it('fails with a clear message when nothing was found', async () => {
    const service = setup(vi.fn().mockResolvedValue({ recipes: [], totalResults: 0, quotaLeft: null }));

    await expect(service.generate(OPTS)).rejects.toThrow(NO_RECIPES_FOUND_MESSAGE);
    expect(TestBed.inject(WeekPlanStore).plan()).toBeNull();
  });
});

describe('WeekPlanService.removeRecipe / replaceRecipe', () => {
  beforeEach(() => vi.restoreAllMocks());

  async function planned(search: ReturnType<typeof vi.fn>): Promise<WeekPlanService> {
    const service = setup(search);
    await service.generate(OPTS);
    return service;
  }
  const page = (ids: string[]) => ({ recipes: ids.map(recipe), totalResults: ids.length, quotaLeft: null });

  it('removes a recipe for this week only and rebuilds the shopping list', async () => {
    const service = await planned(vi.fn().mockResolvedValue(page(['1', '2'])));

    service.removeRecipe('1', false);

    const store = TestBed.inject(WeekPlanStore);
    expect(store.plan()?.recipes.map((r) => r.id)).toEqual(['2']);
    expect(store.blocked()).toEqual([]);
    expect(TestBed.inject(ShoppingStore).list()?.items.map((i) => i.name)).not.toContain('Zutat 1');
  });

  it('blocks a removed recipe so later plans never suggest it again', async () => {
    const search = vi.fn().mockResolvedValue(page(['1', '2', '3']));
    const service = await planned(search);

    service.removeRecipe('1', true);
    const { plan } = await service.generate(OPTS);

    expect(TestBed.inject(WeekPlanStore).blocked()).toEqual(['1']);
    expect(plan.recipes.map((r) => r.id)).not.toContain('1');
  });

  it('replaces a recipe with a new one of the same meal, never one already in the plan', async () => {
    const search = vi.fn().mockResolvedValue(page(['1', '2']));
    const service = await planned(search);
    search.mockResolvedValue(page(['1', '2', '9']));

    await service.replaceRecipe('1', false);

    const ids = TestBed.inject(WeekPlanStore).plan()?.recipes.map((r) => r.id);
    expect(ids).toEqual(['9', '2']);
  });

  it('keeps the plan and does not block when no replacement is found', async () => {
    const search = vi.fn().mockResolvedValue(page(['1', '2']));
    const service = await planned(search);
    search.mockResolvedValue(page(['1', '2']));

    await expect(service.replaceRecipe('1', true)).rejects.toThrow();

    const store = TestBed.inject(WeekPlanStore);
    expect(store.plan()?.recipes.map((r) => r.id)).toEqual(['1', '2']);
    expect(store.blocked()).toEqual([]);
  });
});
