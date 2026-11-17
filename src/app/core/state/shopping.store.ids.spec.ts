import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShoppingItem } from '../models';
import { GenerationCancelledError } from '../shopping/generation-cancelled';
import { RecipeStore } from './recipe.store';
import { ShoppingStore, mergeKept } from './shopping.store';
import { WeekPlan } from '../week-plan/week-plan.model';

const make = (name: string, over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  name,
  amount: 1,
  unit: 'Stk',
  checked: false,
  ...over,
});

const weekPlan = (ingredients: { name: string; amount: number; unit: string }[]): WeekPlan => ({
  id: 'w',
  generatedAt: '2026-01-01T00:00:00.000Z',
  persons: 2,
  days: 1,
  meals: ['dinner'],
  notices: [],
  recipes: [{ id: 'r1', title: 'R1', servings: 2, ingredients, steps: ['x'], meal: 'dinner', portions: 2 }],
});

function freshStore(): ShoppingStore {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  return TestBed.inject(ShoppingStore);
}

describe('ShoppingStore Positions-IDs (E1)', () => {
  let store: ShoppingStore;
  beforeEach(() => {
    store = freshStore();
  });

  it('vergibt jeder neuen Position eine eindeutige id', () => {
    store.addItem(make('Reis'));
    store.addItem(make('Brot'));
    const ids = store.list()!.items.map((i) => i.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it('adressiert Löschen, Abhaken und Preis über die id, nicht über die Position', () => {
    store.addItem(make('Reis'));
    store.addItem(make('Brot'));
    store.addItem(make('Milch'));
    const [reis, brot, milch] = store.list()!.items.map((i) => i.id!);

    store.removeItem(reis);
    store.setItemPrice(milch, 2.5);
    store.toggleItem(brot);

    const items = store.list()!.items;
    expect(items.map((i) => i.name)).toEqual(['Brot', 'Milch']);
    expect(items.find((i) => i.id === brot)?.checked).toBe(true);
    expect(items.find((i) => i.id === milch)?.userPrice).toBe(2.5);
    expect(items.find((i) => i.id === brot)?.userPrice).toBeUndefined();
  });

  it('ignoriert eine unbekannte id', () => {
    store.addItem(make('Reis'));
    store.removeItem('gibt-es-nicht');
    store.toggleItem('gibt-es-nicht');
    store.setItemPrice('gibt-es-nicht', 1);
    expect(store.list()!.items).toHaveLength(1);
    expect(store.list()!.items[0].checked).toBe(false);
  });

  it('vergibt beim Laden ids für Altbestand ohne id', () => {
    localStorage.clear();
    localStorage.setItem(
      'nutritrack:shopping',
      JSON.stringify({
        id: 's',
        dishes: 0,
        persons: 1,
        suggestedDishes: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        items: [
          { name: 'Reis', amount: 1, unit: 'kg', checked: false },
          { name: 'Brot', amount: 1, unit: 'Stk', checked: false },
        ],
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const loaded = TestBed.inject(ShoppingStore).list()!.items;
    expect(loaded.every((i) => typeof i.id === 'string' && i.id.length > 0)).toBe(true);
    expect(new Set(loaded.map((i) => i.id)).size).toBe(2);
  });

  it('behält die id einer Position beim Neu-Generieren aus dem Wochenplan (E8)', () => {
    store.applyWeekPlan(weekPlan([{ name: 'Linsen', amount: 200, unit: 'g' }]));
    const before = store.list()!.items.find((i) => i.name === 'Linsen')!.id;

    store.applyWeekPlan(weekPlan([{ name: 'Linsen', amount: 400, unit: 'g' }]));

    expect(store.list()!.items.find((i) => i.name === 'Linsen')!.id).toBe(before);
  });
});

describe('ShoppingStore Erzeugen: Preise und Hinweise', () => {
  let store: ShoppingStore;
  beforeEach(() => {
    store = freshStore();
  });

  it('übernimmt den eigenen Preis einer erzeugten Position beim Neu-Erzeugen (E4)', () => {
    store.applyWeekPlan(weekPlan([{ name: 'Linsen', amount: 200, unit: 'g' }]));
    const linsen = store.list()!.items.find((i) => i.name === 'Linsen')!;
    store.setItemPrice(linsen.id!, 3.2);

    store.applyWeekPlan(weekPlan([{ name: 'Linsen', amount: 200, unit: 'g' }, { name: 'Reis', amount: 100, unit: 'g' }]));

    expect(store.list()!.items.find((i) => i.name === 'Linsen')?.userPrice).toBe(3.2);
  });

  it('fasst Zwiebeln in g und Stk zu einer Zeile zusammen (E6)', () => {
    store.applyWeekPlan(
      weekPlan([
        { name: 'Zwiebel', amount: 300, unit: 'g' },
        { name: 'Zwiebel', amount: 2, unit: 'Stk' },
      ]),
    );
    const zwiebeln = store.list()!.items.filter((i) => i.name.toLowerCase().startsWith('zwiebel'));
    expect(zwiebeln).toHaveLength(1);
    expect(zwiebeln[0].unit).toBe('Stk');
  });

  it('skaliert den eigenen Preis mit, wenn der Bedarf wächst (E15)', () => {
    const prev = [make('Reis', { amount: 500, unit: 'g', checked: true, userPrice: 2 })];
    const generated = [make('Reis', { amount: 1000, unit: 'g', estPrice: 3 })];
    expect(mergeKept(prev, generated)[0].userPrice).toBe(4);
  });

  it('behält den Hinweis zu übersprungenen Rezepten, wenn sich die Summe ändert (E15)', () => {
    localStorage.setItem(
      'nutritrack:shopping',
      JSON.stringify({
        id: 's', dishes: 1, persons: 1, suggestedDishes: [], generatedAt: '2026-01-01T00:00:00.000Z',
        notice: 'Nicht geladen: X', estTotal: 1, items: [{ name: 'Reis', amount: 1, unit: 'Stk', checked: false, userPrice: 1 }],
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const loaded = TestBed.inject(ShoppingStore);
    loaded.addItem(make('Brot', { userPrice: 2 }));
    expect(loaded.list()!.notice).toBe('Nicht geladen: X');
  });
});

describe('ShoppingStore Abbruch (E2)', () => {
  it('verwirft das Ergebnis, wenn die Anfrage nicht mehr aktuell ist', async () => {
    const store = freshStore();
    TestBed.inject(RecipeStore).add({
      title: 'Reis', servings: 1, steps: [], origin: 'own', ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }],
    });
    store.addItem(make('Eigenes'));
    const before = store.list();

    await expect(
      store.generatePlan({ persons: 1, days: 1, meals: ['dinner'], isCurrent: () => false }),
    ).rejects.toBeInstanceOf(GenerationCancelledError);

    expect(store.list()).toBe(before);
  });
});

describe('ShoppingStore Altbestand ohne ids (Prüfrunde 2)', () => {
  const legacy = { items: [{ name: 'Milch', amount: 1, unit: 'l', checked: false }, { name: 'Brot', amount: 1, unit: 'Stk', checked: false }] };

  it('vergibt die ids einmal, schreibt sie zurück und behält sie beim nächsten Laden', () => {
    localStorage.clear();
    localStorage.setItem('nutritrack:schemaVersion', '1');
    localStorage.setItem('nutritrack:shopping', JSON.stringify(legacy));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const first = TestBed.inject(ShoppingStore).list()?.items.map((i) => i.id);
    window.dispatchEvent(new Event('pagehide'));
    expect(first?.every((id) => typeof id === 'string')).toBe(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const second = TestBed.inject(ShoppingStore).list()?.items.map((i) => i.id);
    expect(second).toEqual(first);
  });
});
