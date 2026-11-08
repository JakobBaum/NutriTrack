import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MockAiProvider } from './mock-ai-provider';


let provider: MockAiProvider;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [MockAiProvider] });
  provider = TestBed.inject(MockAiProvider);
});

// Randfälle des deterministischen Mock-Anbieters.
describe('MockAiProvider — Randfälle', () => {
  it('liefert Etikett-Werte je Basis', async () => {
    const per100 = await provider.recognizeLabel('', 'per100g');
    expect(per100.facts.kcal).toBe(380);
    expect(per100.facts.portionG).toBeUndefined();
    const portion = await provider.recognizeLabel('', 'perPortion');
    expect(portion.facts.kcal).toBe(150);
    expect(portion.facts.portionG).toBe(40);
  });

  it('liefert ohne KI nur Mengen: keine Preise, keine Summe, kein Budget-Hinweis', async () => {
    const recipes = [
      {
        id: 'r', title: 'Reis', servings: 1, steps: [], origin: 'own' as const,
        createdAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z',
        ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }],
      },
    ];
    const res = await provider.generateShoppingList({ persons: 1, days: 1, meals: ['dinner'], recipes, budget: 0.5 });
    expect(res.items).toHaveLength(1);
    expect(res.items.every((i) => i.estPrice === undefined)).toBe(true);
    expect(res.estTotal).toBe(0);
    expect(res.note).toBeUndefined();
  });

  it('sortiert Fastfood nach Protein/kcal und nutzt „Fastfood" als Standard', async () => {
    const res = await provider.suggestFastfood({ restaurant: '', kcalBudget: 5000 });
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

  it('wirft bei Text ohne erkannte Zutaten statt ein leeres Rezept zu liefern', async () => {
    await expect(provider.importRecipe({ text: 'Nur Titel' })).rejects.toThrow(/Keine Zutaten/);
  });

  it('wirft ohne Text und URL', async () => {
    await expect(provider.importRecipe({ text: '   ' })).rejects.toThrow(/Kein Rezept-Text/);
  });

  // BUG: Zeilen mit unbekannter Einheit („3 Becher Joghurt") landen als Schritt statt als Zutat.
  // mock-ai-provider.ts:126 — erwartet: Zutat „Becher Joghurt" (3 Stk), tatsächlich: Zubereitungsschritt.
  it('erkennt Zeilen mit unbekannter Einheit als Zutat', async () => {
    const res = await provider.importRecipe({ text: 'Bowl\n3 Becher Joghurt' });
    expect(res.ingredients).toHaveLength(1);
  });
});
