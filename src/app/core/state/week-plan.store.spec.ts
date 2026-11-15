import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WeekPlan } from '../week-plan/week-plan.model';
import { WeekPlanStore } from './week-plan.store';

const plan = (): WeekPlan => ({
  id: 'w1', generatedAt: '2026-01-01T00:00:00.000Z', persons: 2, days: 3, meals: ['dinner'], notices: [],
  recipes: [{ id: '1', title: 'Linsen', servings: 2, ingredients: [], steps: ['kochen'], meal: 'dinner', portions: 2 }],
});

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('WeekPlanStore', () => {
  it('starts empty', () => {
    expect(TestBed.inject(WeekPlanStore).plan()).toBeNull();
  });

  it('persists the plan and restores it in a new instance', () => {
    TestBed.inject(WeekPlanStore).set(plan());
    TestBed.resetTestingModule();

    expect(TestBed.inject(WeekPlanStore).plan()).toEqual(plan());
    expect(localStorage.getItem('nutritrack:week-plan')).not.toBeNull();
  });

  it('clear removes the plan from state and storage', () => {
    const store = TestBed.inject(WeekPlanStore);
    store.set(plan());

    store.clear();

    expect(store.plan()).toBeNull();
    expect(localStorage.getItem('nutritrack:week-plan')).toBeNull();
  });
});

describe('WeekPlanStore Laden (Review 3, Befund 6)', () => {
  const load = (key: string, raw: unknown): WeekPlanStore => {
    localStorage.setItem(`nutritrack:${key}`, JSON.stringify(raw));
    TestBed.resetTestingModule();
    return TestBed.inject(WeekPlanStore);
  };

  it('verwirft einen kaputten Plan ohne Absturz', () => {
    expect(load('week-plan', { id: 'x', recipes: 'kaputt' }).plan()).toBeNull();
  });

  it('behält gültige Rezepte eines teilweise kaputten Plans', () => {
    const broken = { ...plan(), recipes: [...plan().recipes, { id: 2 }] };
    expect(load('week-plan', broken).plan()?.recipes).toHaveLength(1);
  });

  it('filtert gesperrte Ids auf Texte', () => {
    expect(load('week-plan-blocked', [1, 'a']).blocked()).toEqual(['a']);
    expect(load('week-plan-blocked', 'x').blocked()).toEqual([]);
  });
});
