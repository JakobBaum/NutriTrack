import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShoppingItem } from '../models';
import { ShoppingStore, mergeKept, sumItems } from './shopping.store';

const item = (name: string, estPrice?: number, checked = false): ShoppingItem => ({
  name,
  amount: 1,
  unit: 'Stk',
  checked,
  estPrice,
});

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
});

describe('sumItems', () => {
  it('sums prices and counts items without price', () => {
    expect(sumItems([item('a', 1.5), item('b', 2.25), item('c')])).toEqual({ total: 3.75, unpriced: 1 });
  });
});

describe('mergeKept', () => {
  it('keeps checked and manual items, replaces same name+unit', () => {
    const prev = [item('Reis', 2, true), item('Milch', 1), item('Brot')];
    const generated = [item('reis', 3), item('Nudeln', 1)];

    const merged = mergeKept(prev, generated);

    expect(merged.map((i) => i.name)).toEqual(['Reis', 'Nudeln', 'Brot']);
    expect(merged[0].checked).toBe(true);
  });
});

describe('ShoppingStore total', () => {
  it('derives estTotal when items are added and removed', () => {
    const store = TestBed.inject(ShoppingStore);
    store.addItem(item('a', 2));
    store.addItem(item('b', 3));
    expect(store.list()?.estTotal).toBe(5);

    store.removeItem(0);
    expect(store.list()?.estTotal).toBe(3);
  });
});

describe('mergeKept mit manueller Position ohne Menge', () => {
  it('behält die generierte Menge, wenn die behaltene Position Menge 0 hat', () => {
    const prev: ShoppingItem[] = [{ name: 'Reis', amount: 0, unit: 'g', checked: false }];
    const generated: ShoppingItem[] = [{ name: 'reis', amount: 300, unit: 'g', checked: false, estPrice: 1.2 }];

    const merged = mergeKept(prev, generated);

    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(300);
    expect(merged[0].name).toBe('Reis');
  });

  it('behält die Menge der behaltenen Position, wenn sie > 0 ist', () => {
    const prev: ShoppingItem[] = [{ name: 'Reis', amount: 500, unit: 'g', checked: true }];
    const generated: ShoppingItem[] = [{ name: 'Reis', amount: 300, unit: 'g', checked: false }];

    expect(mergeKept(prev, generated)[0].amount).toBe(500);
  });
});

describe('mergeKept übernimmt Preis und Kategorie der generierten Position', () => {
  it('füllt estPrice und category, wenn die behaltene manuelle Position keine hat', () => {
    const prev: ShoppingItem[] = [{ name: 'Reis', amount: 0, unit: 'g', checked: false }];
    const generated: ShoppingItem[] = [
      { name: 'Reis', amount: 300, unit: 'g', checked: false, estPrice: 1.2, category: 'Trockenware/Nudeln/Reis' },
    ];

    const [merged] = mergeKept(prev, generated);

    expect(merged.estPrice).toBe(1.2);
    expect(merged.category).toBe('Trockenware/Nudeln/Reis');
  });

  it('skaliert den Preis auf die behaltene Menge', () => {
    const prev: ShoppingItem[] = [{ name: 'Reis', amount: 600, unit: 'g', checked: false }];
    const generated: ShoppingItem[] = [{ name: 'Reis', amount: 300, unit: 'g', checked: false, estPrice: 1.2 }];

    expect(mergeKept(prev, generated)[0].estPrice).toBe(2.4);
  });

  it('behält eigene Kategorie und eigenen Preis einer abgehakten Position', () => {
    const prev: ShoppingItem[] = [{ name: 'Reis', amount: 500, unit: 'g', checked: true, estPrice: 9, category: 'Sonstiges' }];
    const generated: ShoppingItem[] = [{ name: 'Reis', amount: 300, unit: 'g', checked: false, estPrice: 1.2, category: 'Obst & Gemüse' }];

    expect(mergeKept(prev, generated)[0]).toMatchObject({ estPrice: 9, category: 'Sonstiges' });
  });
});
