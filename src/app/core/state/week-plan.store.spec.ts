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
