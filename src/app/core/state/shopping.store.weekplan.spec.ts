import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShoppingItem } from '../models';
import { WeekPlan, WeekPlanRecipe } from '../week-plan/week-plan.model';
import { ShoppingStore, mergeKept } from './shopping.store';

const wp = (id: string, servings: number, ingredients: WeekPlanRecipe['ingredients']): WeekPlanRecipe => ({
  id, title: `R${id}`, servings, ingredients, steps: ['x'], meal: 'dinner', portions: 2,
});

const plan = (recipes: WeekPlanRecipe[], persons = 2): WeekPlan => ({
  id: 'w', generatedAt: '2026-01-01T00:00:00.000Z', persons, days: recipes.length, meals: ['dinner'], notices: [], recipes,
});

const find = (items: readonly ShoppingItem[], name: string): ShoppingItem | undefined =>
  items.find((i) => i.name.toLowerCase() === name.toLowerCase());

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
});

describe('ShoppingStore.applyWeekPlan', () => {
  it('adds the ingredients of ALL week recipes scaled to persons and sums equal name and unit', () => {
    const store = TestBed.inject(ShoppingStore);
    const p = plan([
      wp('1', 4, [{ name: 'Linsen', amount: 200, unit: 'g' }, { name: 'Salz', amount: 2, unit: 'g' }]),
      wp('2', 2, [{ name: 'linsen', amount: 100, unit: 'g' }, { name: 'Quark', amount: 250, unit: 'g' }]),
    ]);

    const list = store.applyWeekPlan(p);

    expect(find(list.items, 'Linsen')?.amount).toBeGreaterThanOrEqual(200);
    expect(list.items.filter((i) => i.name.toLowerCase() === 'linsen')).toHaveLength(1);
    expect(find(list.items, 'Quark')).toBeDefined();
    expect(list.persons).toBe(2);
    expect(list.days).toBe(2);
    expect(store.list()?.id).toBe(list.id);
  });

  it('keeps checked and manual items when regenerating, replaces generated ones', () => {
    const store = TestBed.inject(ShoppingStore);
    store.applyWeekPlan(plan([wp('1', 2, [{ name: 'Reis', amount: 100, unit: 'g' }, { name: 'Brokkoli', amount: 1, unit: 'Stk' }])]));
    store.addItem({ name: 'Kaffee', amount: 1, unit: 'Pck', checked: false, manual: true });
    const reisIndex = store.list()!.items.findIndex((i) => i.name === 'Reis');
    store.toggleItem(reisIndex);

    const list = store.applyWeekPlan(plan([wp('2', 2, [{ name: 'Hirse', amount: 100, unit: 'g' }])]));

    const names = list.items.map((i) => i.name);
    expect(names).toContain('Kaffee');
    expect(find(list.items, 'Reis')?.checked).toBe(true);
    expect(names).toContain('Hirse');
    expect(names).not.toContain('Brokkoli');
  });

  it('replaces the whole list when keepExisting is false', () => {
    const store = TestBed.inject(ShoppingStore);
    store.applyWeekPlan(plan([wp('1', 2, [{ name: 'Reis', amount: 100, unit: 'g' }])]));
    store.addItem({ name: 'Kaffee', amount: 1, unit: 'Pck', checked: false, manual: true });
    store.toggleItem(store.list()!.items.findIndex((i) => i.name === 'Reis'));

    const list = store.applyWeekPlan(plan([wp('2', 2, [{ name: 'Hirse', amount: 100, unit: 'g' }])]), false);

    expect(list.items.map((i) => i.name)).toEqual(['Hirse']);
  });

  it('marks generated items so unchecked ones without price are replaced', () => {
    const store = TestBed.inject(ShoppingStore);

    const list = store.applyWeekPlan(plan([wp('1', 2, [{ name: 'Reis', amount: 100, unit: 'g' }])]));

    expect(list.items.every((i) => i.manual === false)).toBe(true);
  });
});

describe('mergeKept manual flag', () => {
  const item = (name: string, over: Partial<ShoppingItem>): ShoppingItem => ({ name, amount: 1, unit: 'Stk', checked: false, ...over });

  it('drops unchecked unpriced items marked manual:false, keeps unmarked ones', () => {
    const merged = mergeKept([item('A', { manual: false }), item('B', {}), item('C', { manual: true })], []);

    expect(merged.map((i) => i.name)).toEqual(['B', 'C']);
  });
});
