import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShoppingItem } from '../models';
import { buildShoppingList } from '../shopping/shopping-generator';
import { normalizeUnit } from '../shopping/shopping-units';
import { RecipeStore } from './recipe.store';
import { ShoppingStore, mergeKept } from './shopping.store';

const it_ = (name: string, amount: number, unit: string, over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  name, amount, unit, checked: false, ...over,
});

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
});

describe('normalizeUnit (QAS-03)', () => {
  it('rechnet kg und l in g und ml um und vereinheitlicht Stück', () => {
    expect(normalizeUnit(1.5, 'kg')).toEqual({ amount: 1500, unit: 'g' });
    expect(normalizeUnit(2, 'l')).toEqual({ amount: 2000, unit: 'ml' });
    expect(normalizeUnit(3, 'Stück')).toEqual({ amount: 3, unit: 'Stk' });
    expect(normalizeUnit(3, 'stk')).toEqual({ amount: 3, unit: 'Stk' });
  });

  it('lässt andere Einheiten unverändert', () => {
    expect(normalizeUnit(2, 'EL')).toEqual({ amount: 2, unit: 'EL' });
  });
});

describe('buildShoppingList Einheiten zusammenführen (QAS-03)', () => {
  const recipe = (ingredients: { name: string; amount: number; unit: string }[]) => ({
    id: 'r', title: 'R', servings: 1, steps: [], origin: 'own' as const, createdAt: '', updatedAt: '', ingredients,
  });

  it('addiert 500 g und 1 kg gleicher Zutat zu einer Position', () => {
    const { items } = buildShoppingList(
      [recipe([{ name: 'Mehl', amount: 500, unit: 'g' }, { name: 'mehl', amount: 1, unit: 'kg' }])], 1, 1,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ amount: 1500, unit: 'g' });
  });

  it('führt Stk und Stück zusammen', () => {
    const { items } = buildShoppingList(
      [recipe([{ name: 'Ei', amount: 2, unit: 'Stk' }, { name: 'Ei', amount: 3, unit: 'Stück' }])], 1, 1,
    );

    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(5);
  });
});

describe('mergeKept (QAS-02 neue Menge, QAS-03 Einheiten, QAS-04 Duplikate)', () => {
  it('übernimmt eine größere neue Menge und hakt die Position wieder ab', () => {
    const prev = [it_('Reis', 500, 'g', { checked: true })];
    const generated = [it_('Reis', 800, 'g')];

    const [merged] = mergeKept(prev, generated);

    expect(merged.amount).toBe(800);
    expect(merged.checked).toBe(false);
  });

  it('behält abgehakt, wenn der neue Bedarf nicht größer ist', () => {
    const [merged] = mergeKept([it_('Reis', 500, 'g', { checked: true })], [it_('Reis', 300, 'g')]);

    expect(merged.amount).toBe(500);
    expect(merged.checked).toBe(true);
  });

  it('erkennt g und kg als gleiche Position', () => {
    const merged = mergeKept([it_('Reis', 1, 'kg', { checked: true })], [it_('Reis', 1500, 'g')]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ amount: 1.5, unit: 'kg', checked: false });
  });

  it('addiert mehrere manuelle Positionen gleichen Namens statt sie zu verwerfen', () => {
    const prev = [it_('Brot', 1, 'Stk', { manual: true }), it_('brot', 2, 'Stk', { manual: true })];

    const merged = mergeKept(prev, []);

    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(3);
  });

  it('addiert manuelle Duplikate auch, wenn eine generierte Position dazukommt', () => {
    const prev = [it_('Brot', 1, 'Stk', { manual: true }), it_('Brot', 2, 'Stk', { manual: true })];

    const merged = mergeKept(prev, [it_('Brot', 1, 'Stk', { manual: false })]);

    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(3);
  });
});

describe('ShoppingStore Flags (QAS-01) und manuelle Positionen', () => {
  const addRecipe = (ingredient: string): void => {
    TestBed.inject(RecipeStore).add({
      title: 'R', servings: 1, steps: [], origin: 'own',
      ingredients: [{ name: ingredient, amount: 100, unit: 'g' }],
    });
  };

  it('markiert ohne KI generierte Positionen mit manual=false, damit sie beim Neu-Generieren ersetzbar sind', async () => {
    addRecipe('Linsen');
    const store = TestBed.inject(ShoppingStore);
    const opts = { persons: 1, days: 1, meals: ['dinner' as const] };

    const first = await store.generatePlan(opts);
    expect(first.items.every((i) => i.manual === false)).toBe(true);

    const recipes = TestBed.inject(RecipeStore);
    recipes.clear();
    addRecipe('Hirse');
    const second = await store.generatePlan(opts);

    expect(second.items.map((i) => i.name)).toEqual(['Hirse']);
  });

  it('markiert per addItem angelegte Positionen als manuell', () => {
    const store = TestBed.inject(ShoppingStore);

    store.addItem(it_('Kaffee', 1, 'Pck'));

    expect(store.list()?.items[0].manual).toBe(true);
  });
});
