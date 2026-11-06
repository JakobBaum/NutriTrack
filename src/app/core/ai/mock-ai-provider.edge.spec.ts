import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MockAiProvider } from './mock-ai-provider';
import { NutritionCalcService } from '../nutrition/nutrition-calc.service';
import { UserProfile } from '../models';

const profile: UserProfile = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate',
  goal: 'maintain', updatedAt: '2026-10-13T00:00:00.000Z',
};

let provider: MockAiProvider;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [MockAiProvider] });
  provider = TestBed.inject(MockAiProvider);
});

// Randfälle des deterministischen Mock-Anbieters.
describe('MockAiProvider — Randfälle', () => {
  it('liefert die Fallback-Formel als Tagesziel', async () => {
    const expected = TestBed.inject(NutritionCalcService).dailyTarget(profile);
    expect(await provider.computeTargets(profile)).toEqual(expected);
  });

  it('liefert Etikett-Werte je Basis', async () => {
    const per100 = await provider.recognizeLabel('', 'per100g');
    expect(per100.facts.kcal).toBe(380);
    expect(per100.facts.portionG).toBeUndefined();
    const portion = await provider.recognizeLabel('', 'perPortion');
    expect(portion.facts.kcal).toBe(150);
    expect(portion.facts.portionG).toBe(40);
  });

  it('setzt einen Budget-Hinweis nur bei Überschreitung', async () => {
    const base = { persons: 1, days: 1, meals: ['dinner' as const], recipes: [] };
    const over = await provider.generateShoppingList({ ...base, budget: 0.5 });
    expect(over.note).toContain('0.50 €');
    const within = await provider.generateShoppingList({ ...base, budget: 1000 });
    expect(within.note).toBeUndefined();
    expect(within.estTotal).toBeGreaterThan(0);
  });

  it('sortiert Fastfood nach Protein/kcal und nutzt „Fastfood" als Standard', async () => {
    const res = await provider.suggestFastfood({ restaurant: '', kcalBudget: 0 });
    expect(res[0].itemName).toBe('Grilled Chicken (ohne Mayo)');
    expect(res.every((s) => s.restaurant === 'Fastfood')).toBe(true);
  });

  it('parst Dezimalkomma, Einheiten mit Punkt und leere Zeilen', async () => {
    const text = ['Brot', '', '1,5 kg Mehl', '2 EL. Öl', '   ', 'Backen.'].join('\n');
    const res = await provider.importRecipe({ text });
    expect(res.ingredients[0]).toMatchObject({ name: 'Mehl', amount: 1.5, unit: 'kg' });
    expect(res.ingredients[1]).toMatchObject({ name: 'Öl', amount: 2, unit: 'EL' });
    expect(res.steps).toEqual(['Backen.']);
  });

  it('nutzt die erste Zeile als Titel auch ohne Zutaten', async () => {
    const res = await provider.importRecipe({ text: 'Nur Titel' });
    expect(res.title).toBe('Nur Titel');
    expect(res.ingredients).toEqual([]);
    expect(res.steps).toEqual([]);
  });

  it('liefert ohne Text und URL einen leeren Platzhalter', async () => {
    const res = await provider.importRecipe({ text: '   ' });
    expect(res.steps).toEqual([]);
    expect(res.sourceUrl).toBeUndefined();
  });

  // BUG: Zeilen mit unbekannter Einheit („3 Becher Joghurt") landen als Schritt statt als Zutat.
  // mock-ai-provider.ts:126 — erwartet: Zutat „Becher Joghurt" (3 Stk), tatsächlich: Zubereitungsschritt.
  it('erkennt Zeilen mit unbekannter Einheit als Zutat', async () => {
    const res = await provider.importRecipe({ text: 'Bowl\n3 Becher Joghurt' });
    expect(res.ingredients).toHaveLength(1);
  });
});
