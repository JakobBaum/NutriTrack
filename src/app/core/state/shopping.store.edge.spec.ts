import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShoppingItem } from '../models';
import { AiService } from '../ai/ai.service';
import { RecipeStore } from './recipe.store';
import { ShoppingStore, mergeKept, sumItems } from './shopping.store';

const item = (name: string, estPrice?: number, checked = false): ShoppingItem => ({
  name, amount: 1, unit: 'Stk', checked, estPrice,
});

function setup(ai?: Partial<AiService>): ShoppingStore {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), ...(ai ? [{ provide: AiService, useValue: ai }] : [])],
  });
  return TestBed.inject(ShoppingStore);
}

describe('sumItems / mergeKept — Randfälle', () => {
  it('zählt NaN/Infinity-Preise als unbepreist', () => {
    expect(sumItems([item('a', Number.NaN), item('b', Number.POSITIVE_INFINITY), item('c', 0.1)]))
      .toEqual({ total: 0.1, unpriced: 2 });
    expect(sumItems([])).toEqual({ total: 0, unpriced: 0 });
  });

  it('rundet die Summe auf Cent', () => {
    expect(sumItems([item('a', 0.1), item('b', 0.2)]).total).toBe(0.3);
  });

  it('verwirft unabgehakte bepreiste Positionen, addiert manuelle Duplikate und schätzt den Preis für die Menge neu', () => {
    const prev = [item('Milch', 1), item('Brot', undefined), item('brot', undefined)];
    const generated = [item('Brot', 2)];
    const merged = mergeKept(prev, generated);
    expect(merged.map((i) => i.amount)).toEqual([2]);
    expect(merged.map((i) => i.estPrice)).toEqual([2.25]);
  });

  it('liefert generierte Positionen bei leerer Vorliste unverändert', () => {
    const generated = [item('Reis', 2)];
    expect(mergeKept([], generated)).toEqual(generated);
  });
});

describe('ShoppingStore — Verhalten', () => {
  let store: ShoppingStore;
  const addRecipe = (): void => {
    TestBed.inject(RecipeStore).add({
      title: 'Reis', servings: 1, steps: [], origin: 'own',
      ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }],
    });
  };

  beforeEach(() => {
    store = setup();
  });

  it('ignoriert toggle/remove ohne Liste', () => {
    store.toggleItem(0);
    store.removeItem(0);
    expect(store.list()).toBeNull();
  });

  it('ignoriert einen Index außerhalb der Liste', () => {
    store.addItem(item('a', 2));
    store.removeItem(5);
    store.toggleItem(-1);
    expect(store.list()?.items).toHaveLength(1);
    expect(store.list()?.items[0].checked).toBe(false);
  });

  it('persistiert und lädt die Liste neu', () => {
    store.addItem(item('a', 2));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    expect(TestBed.inject(ShoppingStore).list()?.items[0].name).toBe('a');
  });

  it('löscht Liste und Speicher bei clear()', () => {
    store.addItem(item('a', 2));
    store.clear();
    expect(store.list()).toBeNull();
    expect(localStorage.getItem('nutritrack:shopping')).toBeNull();
  });

  it('generiert ohne KI mit geschätzten Preisen, ignoriert Budget/Markt und behält abgehakte Positionen', async () => {
    addRecipe();
    store.addItem(item('Eigenes', undefined, true));
    const list = await store.generatePlan({ persons: 2, days: 7, meals: ['dinner'], budget: 1, store: 'Lidl' });
    expect(list.priceSource).toBe('mock');
    expect(list.budget).toBeUndefined();
    expect(list.store).toBeUndefined();
    expect(list.note).toBeUndefined();
    expect(list.items.some((i) => i.name === 'Eigenes' && i.checked)).toBe(true);
    expect(list.items.filter((i) => !i.checked).every((i) => i.estPrice !== undefined)).toBe(true);
    expect(list.dishes).toBe(7);
    expect(list.estTotal).toBeGreaterThan(0);
  });

  it('verweigert die Generierung ohne KI und ohne Rezepte', async () => {
    await expect(store.generatePlan({ persons: 2, days: 3, meals: ['dinner'] })).rejects.toThrow('Rezepte');
    expect(store.list()).toBeNull();
  });

  it('behält eigene Positionen mit selbst eingetragenem Preis beim Neu-Generieren', async () => {
    addRecipe();
    store.addItem({ name: 'Kaffee', amount: 1, unit: 'Pck', checked: false, userPrice: 5.5, manual: true });
    const list = await store.generatePlan({ persons: 1, days: 1, meals: ['dinner'] });
    expect(list.items.find((i) => i.name === 'Kaffee')?.userPrice).toBe(5.5);
  });

  it('erzwingt Mindestwerte für Personen/Tage/Mahlzeiten', async () => {
    addRecipe();
    const list = await store.generatePlan({ persons: 0, days: 0.5, meals: [] });
    expect(list.persons).toBe(1);
    expect(list.days).toBe(1);
    expect(list.dishes).toBe(1);
  });

  it('entfernt einen Hinweis zur alten Summe, sobald sich die Positionen ändern', () => {
    store.addItem(item('a', 2));
    store.removeItem(0);
    expect(store.list()?.note).toBeUndefined();
  });
});

describe('ShoppingStore — KI-Fehler', () => {
  it('fällt ohne Live-KI auf den Mock zurück', async () => {
    const store = setup({
      isLive: () => false,
      generateShoppingList: () => Promise.reject(new Error('kaputt')),
    });
    TestBed.inject(RecipeStore).add({
      title: 'Reis', servings: 1, steps: [], origin: 'own', ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }],
    });
    const list = await store.generatePlan({ persons: 1, days: 1, meals: ['lunch'] });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.priceSource).toBe('mock');
  });

  it('gibt den Fehler bei Live-KI weiter und lässt die Liste unverändert', async () => {
    const store = setup({
      isLive: () => true,
      generateShoppingList: () => Promise.reject(new Error('Proxy down')),
    });
    await expect(store.generatePlan({ persons: 1, days: 1, meals: ['lunch'] })).rejects.toThrow('Proxy down');
    expect(store.list()).toBeNull();
  });

  it('markiert KI-Ergebnisse als priceSource ai', async () => {
    const store = setup({
      isLive: () => true,
      generateShoppingList: () =>
        Promise.resolve({ items: [item('Reis', 2.5)], suggestedDishes: ['Curry'], estTotal: 99 }),
    });
    const list = await store.generatePlan({ persons: 1, days: 1, meals: ['lunch'] });
    expect(list.priceSource).toBe('ai');
    expect(list.estTotal).toBe(2.5);
    expect(list.suggestedDishes).toEqual(['Curry']);
  });

  it('ergänzt mit KI fehlende Preise über die Kategorie-Tabelle', async () => {
    const store = setup({
      isLive: () => true,
      generateShoppingList: () =>
        Promise.resolve({
          items: [{ name: 'Hähnchenbrust', amount: 500, unit: 'g', checked: false, category: 'Fleisch & Fisch' }],
          suggestedDishes: [],
          estTotal: 0,
        }),
    });
    const list = await store.generatePlan({ persons: 1, days: 1, meals: ['lunch'] });
    expect(list.items[0].estPrice).toBeGreaterThan(0);
  });
});
