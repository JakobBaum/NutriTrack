import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RecipeTranslateService } from '../recipes/translate/recipe-translate';
import { SpoonacularProvider } from '../recipes/online/spoonacular.provider';
import { RecipeSearchAccessService } from '../recipes/online/recipe-search-access';
import { WeekPlanStore } from '../state/week-plan.store';
import { WeekPlan } from './week-plan.model';
import { WeekPlanService } from './week-plan.service';

const plan = (): WeekPlan => ({
  id: 'w1',
  generatedAt: '2026-11-09T10:00:00.000Z',
  persons: 2,
  days: 2,
  meals: ['dinner'],
  notices: [],
  recipes: [{ id: '1', title: 'Chicken', servings: 2, steps: ['x'], ingredients: [], meal: 'dinner', portions: 2, lang: 'en' }],
});

function setup(translateAll: ReturnType<typeof vi.fn>): WeekPlanService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: SpoonacularProvider, useValue: { search: vi.fn() } },
      { provide: RecipeSearchAccessService, useValue: { isAvailable: () => true } },
      { provide: RecipeTranslateService, useValue: { needsTranslation: () => true, translateAll } },
    ],
  });
  TestBed.inject(WeekPlanStore).set(plan());
  return TestBed.inject(WeekPlanService);
}

describe('WeekPlanService.retryTranslation', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('versucht die Übersetzung pro Sitzung nur einmal automatisch', async () => {
    const translateAll = vi.fn().mockImplementation(async (r: unknown[]) => r);
    const service = setup(translateAll);

    await service.ensureTranslated();
    await service.ensureTranslated();

    expect(translateAll).toHaveBeenCalledTimes(1);
  });

  it('startet die Übersetzung auf Wunsch erneut', async () => {
    const translateAll = vi.fn().mockImplementation(async (r: unknown[]) => r);
    const service = setup(translateAll);
    await service.ensureTranslated();

    await service.retryTranslation();

    expect(translateAll).toHaveBeenCalledTimes(2);
  });

  it('tut ohne Plan nichts', async () => {
    const translateAll = vi.fn();
    const service = setup(translateAll);
    TestBed.inject(WeekPlanStore).clear();

    await service.retryTranslation();

    expect(translateAll).not.toHaveBeenCalled();
  });
});
