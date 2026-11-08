import { describe, expect, it } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NtFoodRowComponent } from './food-row.component';
import { FoodItem } from '../../core/models';

const item: FoodItem = {
  id: '1', source: 'openfoodfacts', name: 'Nutella', brand: 'Ferrero', quantity: '400 g',
  nutriscore: 'e',
  facts: { kcal: 539.4, proteinG: 6, carbsG: 57, fatG: 31, fiberG: 0, sugarG: 56, saltG: 0, basis: 'per100g' },
};

function render(it: FoodItem): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ declarations: [NtFoodRowComponent], schemas: [CUSTOM_ELEMENTS_SCHEMA] });
  const f = TestBed.createComponent(NtFoodRowComponent);
  f.componentRef.setInput('item', it);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('NtFoodRowComponent', () => {
  it('zeigt Name, Marke mit Packungsgröße, kcal, Eiweiß und Nutri-Score', () => {
    const el = render(item);
    expect(el.querySelector('.name')?.textContent).toContain('Nutella');
    expect(el.querySelector('.sub')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Ferrero · 400 g');
    expect(el.querySelector('.meta')?.textContent).toBe('539 kcal · 6 g Eiweiß / 100 g');
    expect(el.querySelector('.score')?.getAttribute('aria-label')).toBe('Nutri-Score E');
    expect(el.querySelector('.own-tag')).toBeNull();
  });

  it('zeigt keine Bilder und keine Platzhalter-Icons', () => {
    const el = render({ ...item, imageUrl: 'https://img/x.jpg' } as FoodItem);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('ion-icon')).toBeNull();
    expect(el.querySelector('.thumb')).toBeNull();
  });

  it('blendet Untertitel und Score aus, wenn Marke, Größe und Nutri-Score fehlen', () => {
    const el = render({ ...item, brand: undefined, nutriscore: undefined, quantity: undefined });
    expect(el.querySelector('.sub')).toBeNull();
    expect(el.querySelector('.score')).toBeNull();
    expect(el.querySelector('.meta')?.textContent).toBe('539 kcal · 6 g Eiweiß / 100 g');
  });

  it('zeigt bei nur einer Angabe ohne Trennzeichen', () => {
    expect(render({ ...item, quantity: undefined }).querySelector('.sub')?.textContent?.trim()).toBe('Ferrero');
    expect(render({ ...item, brand: undefined }).querySelector('.sub')?.textContent?.trim()).toBe('400 g');
  });

  it('kennzeichnet eigene Lebensmittel mit „Eigen“ und nennt die Portionsbasis', () => {
    const el = render({
      id: 'custom:1', source: 'custom', name: 'Haferbrei',
      facts: { kcal: 250, proteinG: 12.4, carbsG: 30, fatG: 5, basis: 'perPortion' },
    });
    expect(el.querySelector('.own-tag')?.textContent).toBe('Eigen');
    expect(el.querySelector('.meta')?.textContent).toBe('250 kcal · 12 g Eiweiß / Portion');
  });
});
