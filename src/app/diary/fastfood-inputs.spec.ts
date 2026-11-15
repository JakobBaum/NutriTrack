import { describe, expect, it } from 'vitest';
import { FastFoodForm, fastfoodInputsOf, sameFastfoodInputs } from './fastfood-options';

describe('Angaben der Anfrage (Schnappschuss)', () => {
  const form: FastFoodForm = { restaurant: 'KFC', kcalBudget: 600, moneyBudget: null, preferences: ['viel Protein', 'günstig'], country: 'Österreich' };

  it('löst das kcal-Budget mit dem Resttag auf, wenn keins gesetzt ist', () => {
    expect(fastfoodInputsOf({ ...form, kcalBudget: null }, 823).kcalBudget).toBe(800);
    expect(fastfoodInputsOf(form, 823).kcalBudget).toBe(600);
  });

  it('kopiert die Kriterien, damit spätere Änderungen den Schnappschuss nicht berühren', () => {
    const copy = { ...form, preferences: [...form.preferences] };
    const inputs = fastfoodInputsOf(copy, 500);
    copy.preferences.push('x');
    expect(inputs.preferences).toEqual(['viel Protein', 'günstig']);
  });

  it('hält gleiche Angaben für gleich, unabhängig von der Reihenfolge der Kriterien', () => {
    const a = fastfoodInputsOf(form, 500);
    const b = fastfoodInputsOf({ ...form, preferences: ['günstig', 'viel Protein'] }, 500);
    expect(sameFastfoodInputs(a, b)).toBe(true);
  });

  it.each([
    ['Restaurant', { restaurant: 'Subway' }],
    ['kcal-Budget', { kcalBudget: 650 }],
    ['Geld-Budget', { moneyBudget: 8 }],
    ['Kriterien', { preferences: ['günstig'] }],
    ['Land', { country: 'Italien' }],
  ])('erkennt eine Änderung bei %s', (_name, patch) => {
    expect(sameFastfoodInputs(fastfoodInputsOf(form, 500), fastfoodInputsOf({ ...form, ...patch }, 500))).toBe(false);
  });
});
