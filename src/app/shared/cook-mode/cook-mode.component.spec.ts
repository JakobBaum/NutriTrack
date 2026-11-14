import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CookIngredient, NtCookModeComponent } from './cook-mode.component';

const ING: CookIngredient[] = [
  { name: 'Zwiebel', amount: 2, unit: 'Stk' },
  { name: 'Reis', amount: 200, unit: 'g' },
];
const STEPS = ['Zwiebeln würfeln.', 'Reis in einem Topf kochen.', 'Alles servieren.'];

function setup(steps: string[], ingredients: CookIngredient[]) {
  TestBed.configureTestingModule({ declarations: [NtCookModeComponent], schemas: [CUSTOM_ELEMENTS_SCHEMA] });
  const fixture = TestBed.createComponent(NtCookModeComponent);
  fixture.componentRef.setInput('steps', steps);
  fixture.componentRef.setInput('ingredients', ingredients);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('NtCookModeComponent (Ableitungen)', () => {
  it('hat eine Startseite und ordnet jedem Schritt seine Zutaten zu', () => {
    const cook = setup(STEPS, ING);
    expect(cook.hasIntro()).toBe(true);
    expect(cook.total()).toBe(4);
    expect(cook.stepIngredients().map((list) => list.map((i) => i.name))).toEqual([['Zwiebel'], ['Reis'], []]);
  });

  it('listet die Utensilien aus den Schritten', () => {
    expect(setup(STEPS, ING).utensils()).toEqual(['Messer und Schneidebrett', 'Topf']);
  });

  it('hat die Startseite auch ohne Zutaten, wenn Utensilien erkannt werden', () => {
    const cook = setup(STEPS, []);
    expect(cook.hasIntro()).toBe(true);
    expect(cook.total()).toBe(4);
  });

  it('hat keine Startseite ohne Zutaten und ohne Utensilien', () => {
    const cook = setup(['Alles gut servieren.'], []);
    expect(cook.hasIntro()).toBe(false);
    expect(cook.total()).toBe(1);
  });

  it('zeigt bei Schritt ohne Treffer keine Zutaten und bei Startseite keinen Schritt', () => {
    const cook = setup(STEPS, ING);
    expect(cook.currentStepIngredients()).toEqual([]);
    expect(cook.stepIndex()).toBe(-1);
    cook.next();
    expect(cook.currentStepIngredients().map((i) => i.name)).toEqual(['Zwiebel']);
    cook.next();
    cook.next();
    expect(cook.currentStepIngredients()).toEqual([]);
  });
});
