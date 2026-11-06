import { describe, expect, it } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NtFoodRowComponent } from './food-row.component';
import { FoodItem } from '../../core/models';

const item: FoodItem = {
  id: '1', source: 'openfoodfacts', name: 'Nutella', brand: 'Ferrero', quantity: '400 g',
  nutriscore: 'e', imageUrl: 'https://img/x.jpg',
  facts: { kcal: 539.4, proteinG: 6, carbsG: 57, fatG: 31, fiberG: 0, sugarG: 56, saltG: 0, basis: 'per100g' },
};

function render(it: FoodItem): HTMLElement {
  TestBed.configureTestingModule({ declarations: [NtFoodRowComponent], schemas: [CUSTOM_ELEMENTS_SCHEMA] });
  const f = TestBed.createComponent(NtFoodRowComponent);
  f.componentRef.setInput('item', it);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('NtFoodRowComponent', () => {
  it('zeigt Name, Marke, Menge, kcal und Nutri-Score', () => {
    const el = render(item);
    expect(el.querySelector('.name')?.textContent).toContain('Nutella');
    expect(el.querySelector('.brand')?.textContent).toContain('Ferrero');
    expect(el.querySelector('.meta')?.textContent).toContain('400 g · 539 kcal / 100 g');
    expect(el.querySelector('.score')?.getAttribute('aria-label')).toBe('Nutri-Score E');
    expect(el.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  });

  it('blendet Marke, Score aus und zeigt Fallback-Icon ohne Bild', () => {
    const el = render({ ...item, brand: undefined, nutriscore: undefined, imageUrl: undefined, quantity: undefined });
    expect(el.querySelector('.brand')).toBeNull();
    expect(el.querySelector('.score')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('ion-icon')).not.toBeNull();
    expect(el.querySelector('.meta')?.textContent?.trim()).toBe('539 kcal / 100 g');
  });
});
