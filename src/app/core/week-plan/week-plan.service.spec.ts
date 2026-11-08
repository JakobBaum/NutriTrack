import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RecipeSearchAccessService } from '../recipes/online/recipe-search-access';
import { OnlineSearchError } from '../recipes/online/spoonacular.errors';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { SpoonacularProvider } from '../recipes/online/spoonacular.provider';
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
