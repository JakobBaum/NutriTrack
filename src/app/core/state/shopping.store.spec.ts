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
