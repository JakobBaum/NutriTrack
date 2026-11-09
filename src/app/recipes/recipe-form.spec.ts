import { Recipe } from '../core/models';
import {
  IngredientForm,
  applyFact,
  buildRecipeDraft,
  cookedWeightIsEstimate,
  cookedWeightValue,
  emptyForm,
  formFromImport,
  formFromRecipe,
  nextCookedWeight,
  recipeDiaryEntry,
  toRecipeIngredients,
} from './recipe-form';

const FACTS = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5, basis: 'per100g' as const };

function ing(over: Partial<IngredientForm> = {}): IngredientForm {
  return { name: 'Reis', amount: 100, unit: 'g', facts: FACTS, ...over };
}

describe('recipe-form', () => {
  describe('toRecipeIngredients', () => {
    it('verwirft leere Namen, trimmt und setzt Standardeinheit g', () => {
      const result = toRecipeIngredients([ing({ name: '  Reis ', unit: ' ' }), ing({ name: '   ' })]);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Reis');
      expect(result[0].unit).toBe('g');
    });

    it('macht fehlende oder negative Mengen zu 0', () => {
      const result = toRecipeIngredients([ing({ amount: null }), ing({ amount: -5 })]);
      expect(result.map((i) => i.amount)).toEqual([0, 0]);
    });
  });

  describe('cooked weight', () => {
    it('nimmt die eigene Eingabe vor der Schaetzung', () => {
      expect(cookedWeightValue(300, 120)).toBe(300);
      expect(cookedWeightIsEstimate(300, 120)).toBe(false);
    });

    it('faellt ohne Eingabe auf die Schaetzung zurueck', () => {
      expect(cookedWeightValue(null, 120)).toBe(120);
      expect(cookedWeightIsEstimate(null, 120)).toBe(true);
    });

    it('liefert null ohne Eingabe und ohne Schaetzung', () => {
      expect(cookedWeightValue(null, 0)).toBeNull();
      expect(cookedWeightIsEstimate(null, 0)).toBe(false);
    });

    it('nextCookedWeight: leer, 0 oder unveraendert ergibt wieder die Schaetzung', () => {
      expect(nextCookedWeight('', 120)).toBeNull();
      expect(nextCookedWeight('0', 120)).toBeNull();
      expect(nextCookedWeight('120', 120)).toBeNull();
      expect(nextCookedWeight('250,5', 120)).toBe(250.5);
    });
  });

  describe('applyFact', () => {
    it('setzt kcal immutabel und laesst das Original unveraendert', () => {
      const next = applyFact(FACTS, 'kcal', '350');
      expect(next.kcal).toBe(350);
      expect(FACTS.kcal).toBe(200);
    });

    it('ungueltige Pflichtwerte werden 0, optionale undefined', () => {
      expect(applyFact(FACTS, 'proteinG', 'abc').proteinG).toBe(0);
      expect(applyFact(FACTS, 'fiberG', 'abc').fiberG).toBeUndefined();
    });
  });

  describe('formFromRecipe / formFromImport', () => {
    it('formFromImport hat Standard 2 Portionen und einen leeren Schritt', () => {
      const form = formFromImport({ title: 'T', servings: 0, ingredients: [], steps: [] });
      expect(form.servings).toBe(2);
      expect(form.steps).toEqual(['']);
      expect(form.cookedWeightG).toBeNull();
    });

    it('formFromRecipe kopiert Zutaten und entkoppelt die Schritte', () => {
      const recipe = {
        id: 'r1', title: 'Suppe', servings: 4, cookedWeightG: 900, steps: ['a'],
        ingredients: [{ name: 'Wasser', amount: 1, unit: 'l' }],
      } as unknown as Recipe;
      const form = formFromRecipe(recipe);
      expect(form.cookedWeightG).toBe(900);
      expect(form.ingredients[0].name).toBe('Wasser');
      expect(form.steps).not.toBe(recipe.steps);
    });

    it('emptyForm liefert pro Aufruf ein neues Objekt', () => {
      expect(emptyForm()).not.toBe(emptyForm());
    });
  });

  describe('buildRecipeDraft', () => {
    it('meldet fehlenden Titel', () => {
      const result = buildRecipeDraft({ ...emptyForm(), title: '  ' }, 'own');
      expect('error' in result && result.error).toMatch(/Titel/);
    });

    it('meldet ungueltige Portionen', () => {
      const result = buildRecipeDraft({ ...emptyForm(), title: 'X', servings: 0.5 }, 'own');
      expect('error' in result && result.error).toMatch(/Portion/);
    });

    it('nutzt berechnetes Gewicht, wenn keins eingegeben wurde', () => {
      const form = { ...emptyForm(), title: 'X', servings: 2, ingredients: [ing({ amount: 200 })], steps: [' a ', ''] };
      const result = buildRecipeDraft(form, 'text');
      if ('error' in result) throw new Error(result.error);
      expect(result.draft.cookedWeightG).toBe(200);
      expect(result.draft.steps).toEqual(['a']);
      expect(result.draft.origin).toBe('text');
    });

    it('bevorzugt die eigene Gewichtseingabe', () => {
      const form = { ...emptyForm(), title: 'X', cookedWeightG: 150, ingredients: [ing({ amount: 200 })] };
      const result = buildRecipeDraft(form, 'own');
      if ('error' in result) throw new Error(result.error);
      expect(result.draft.cookedWeightG).toBe(150);
    });
  });

  describe('recipeDiaryEntry', () => {
    const recipe = {
      id: 'r1', title: 'Suppe', servings: 2, steps: [], origin: 'own',
      factsPerServing: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' },
      ingredients: [{ name: 'A', amount: 1, unit: 'g' }],
    } as unknown as Recipe;

    it('skaliert auf die gegessenen Portionen und verweist aufs Rezept', () => {
      const withFacts = { ...recipe, ingredients: [{ name: 'A', amount: 1, unit: 'g', facts: FACTS }] } as unknown as Recipe;
      const entry = recipeDiaryEntry(withFacts, 'lunch', 1.5, '2026-11-09');
      expect(entry.servings).toBe(1.5);
      expect(entry.ref).toEqual({ kind: 'recipe', recipeId: 'r1' });
      expect(entry.isPartial).toBeUndefined();
    });

    it('markiert Rezepte mit Zutaten ohne Werte als unvollstaendig', () => {
      const entry = recipeDiaryEntry(recipe, 'dinner', 1, '2026-11-09');
      expect(entry.isPartial).toBe(true);
    });
  });
});
