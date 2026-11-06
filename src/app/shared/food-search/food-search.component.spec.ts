import { describe, expect, it, vi } from 'vitest';
import { ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NtFoodSearchComponent } from './food-search.component';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { FoodItem } from '../../core/models';

const item: FoodItem = {
  id: '1', source: 'openfoodfacts', name: 'Nutella', imageUrl: 'https://img/x.jpg',
  facts: { kcal: 539, proteinG: 6, carbsG: 57, fatG: 31, fiberG: 0, sugarG: 56, saltG: 0, basis: 'per100g' },
};

function setup(results: FoodItem[]) {
  TestBed.configureTestingModule({
    declarations: [NtFoodSearchComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [{ provide: FOOD_PROVIDER, useValue: { searchByText: async () => results } }],
  });
  const fixture = TestBed.createComponent(NtFoodSearchComponent);
  fixture.detectChanges();
  return fixture;
}

describe('NtFoodSearchComponent', () => {
  it('Enter wählt den ersten Treffer und leert danach die Suche', async () => {
    const fixture = setup([item]);
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);
    fixture.componentInstance.search.query = 'nutella';

    await (fixture.componentInstance as unknown as { pickFirst(): Promise<void> }).pickFirst();

    expect(picked).toHaveBeenCalledWith(item);
    expect(fixture.componentInstance.query).toBe('');
  });

  it('zeigt „Manuell eintragen“ ohne Treffer und meldet den Suchbegriff', async () => {
    const fixture = setup([]);
    const manual = vi.fn();
    fixture.componentInstance.manualEntry.subscribe(manual);
    fixture.componentInstance.search.query = 'zzzz';
    await fixture.componentInstance.search.run();
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.inline-action');
    btn?.click();

    expect(btn).not.toBeNull();
    expect(manual).toHaveBeenCalledWith('zzzz');
  });

  it('blendet „Manuell eintragen“ mit allowManual=false aus', async () => {
    const fixture = setup([]);
    fixture.componentRef.setInput('allowManual', false);
    fixture.componentInstance.search.query = 'zzzz';
    await fixture.componentInstance.search.run();
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.inline-action')).toBeNull();
  });

  it('rendert Treffer mit Vorschaubild in nt-food-row', async () => {
    const fixture = setup([item]);
    fixture.componentInstance.search.query = 'nutella';
    await fixture.componentInstance.search.run();
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('nt-food-row')).toHaveLength(1);
  });
});
