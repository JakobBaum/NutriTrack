import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NtFoodSearchComponent } from './food-search.component';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { CustomFoodStore } from '../../core/state/custom-food.store';
import { FoodItem } from '../../core/models';

const item: FoodItem = {
  id: '1', source: 'openfoodfacts', name: 'Nutella',
  facts: { kcal: 539, proteinG: 6, carbsG: 57, fatG: 31, fiberG: 0, sugarG: 56, saltG: 0, basis: 'per100g' },
};
const OWN_FACTS = { kcal: 300, proteinG: 10, carbsG: 30, fatG: 8, basis: 'perPortion' as const };

function setup(results: FoodItem[], searchByText: () => Promise<FoodItem[]> = async () => results) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [NtFoodSearchComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [{ provide: FOOD_PROVIDER, useValue: { searchByText } }],
  });
  const fixture = TestBed.createComponent(NtFoodSearchComponent);
  fixture.detectChanges();
  return fixture;
}

async function search(fixture: ReturnType<typeof setup>, query: string): Promise<HTMLElement> {
  fixture.componentInstance.search.query = query;
  await fixture.componentInstance.search.run();
  fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('NtFoodSearchComponent', () => {
  beforeEach(() => localStorage.clear());

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
    const el = await search(fixture, 'zzzz');

    const btn = el.querySelector<HTMLButtonElement>('.inline-action');
    btn?.click();

    expect(btn).not.toBeNull();
    expect(manual).toHaveBeenCalledWith('zzzz');
  });

  it('blendet „Manuell eintragen“ mit allowManual=false aus', async () => {
    const fixture = setup([]);
    fixture.componentRef.setInput('allowManual', false);
    const el = await search(fixture, 'zzzz');

    expect(el.querySelector('.inline-action')).toBeNull();
  });

  it('rendert Treffer in nt-food-row ohne Bilder', async () => {
    const fixture = setup([item]);
    const el = await search(fixture, 'nutella');

    expect(el.querySelectorAll('nt-food-row')).toHaveLength(1);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.data-credit')).not.toBeNull();
  });

  it('zeigt eigene Lebensmittel bei Namens-Übereinstimmung vor den Online-Treffern', async () => {
    const fixture = setup([item]);
    TestBed.inject(CustomFoodStore).save('Nutella Hausmischung', OWN_FACTS);
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);
    const el = await search(fixture, 'nutella');

    expect(el.querySelectorAll('nt-food-row')).toHaveLength(2);
    el.querySelector<HTMLElement>('ion-item')?.click();
    expect(picked.mock.calls[0][0]).toMatchObject({ source: 'custom', name: 'Nutella Hausmischung' });
  });

  it('zeigt eigene Treffer auch, wenn die Online-Suche ausfällt, ohne ODbL-Credit', async () => {
    const fixture = setup([], async () => { throw new Error('offline'); });
    TestBed.inject(CustomFoodStore).save('Joghurt Natur', OWN_FACTS);
    const el = await search(fixture, 'joghurt');

    expect(el.querySelectorAll('nt-food-row')).toHaveLength(1);
    expect(el.querySelector('.data-credit')).toBeNull();
  });

  it('zeigt ohne Suchbegriff die zuletzt genutzten eigenen Lebensmittel, wenn aktiviert', () => {
    const fixture = setup([]);
    const store = TestBed.inject(CustomFoodStore);
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((n) => store.save(`Eigenes ${n}`, OWN_FACTS));
    fixture.componentRef.setInput('showRecentCustom', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('nt-food-row')).toHaveLength(5);
    expect(el.querySelector('.nt-section-header')?.textContent).toContain('Eigene Lebensmittel');
  });

  it('zeigt ohne Aktivierung keine eigenen Lebensmittel bei leerer Suche', () => {
    const fixture = setup([]);
    TestBed.inject(CustomFoodStore).save('Eigenes A', OWN_FACTS);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('nt-food-row')).toHaveLength(0);
  });
});
