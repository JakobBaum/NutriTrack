import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';
import { FastfoodFormComponent } from './fastfood-form.component';
import { FastFoodForm } from './fastfood-options';

const FORM: FastFoodForm = { restaurant: 'KFC', kcalBudget: 600, moneyBudget: null, preferences: ['viel Protein'], country: 'Schweiz' };

function setup() {
  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    declarations: [FastfoodFormComponent],
    imports: [FormsModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [{ provide: Router, useValue: { navigate } }],
  });
  const fixture = TestBed.createComponent(FastfoodFormComponent);
  fixture.componentRef.setInput('form', FORM);
  fixture.componentRef.setInput('live', true);
  fixture.detectChanges();
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('FastfoodFormComponent Land', () => {
  it('zeigt das Land aus dem Profil als Hinweis statt einer eigenen Auswahl', () => {
    const { el } = setup();
    expect(el.querySelector('ion-select[label="Land"]')).toBeNull();
    expect(el.querySelector('[data-testid="ff-country"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Land: Schweiz, im Profil ändern');
  });

  it('öffnet über den Link das Profil und schließt vorher das Sheet', () => {
    const { fixture, navigate, el } = setup();
    const opened = vi.fn();
    fixture.componentInstance.openProfile.subscribe(opened);
    (el.querySelector('[data-testid="ff-country-link"]') as HTMLButtonElement).click();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/settings'], { queryParams: { setup: '1' } });
  });
});
