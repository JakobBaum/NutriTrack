import { Recipe } from '../core/models';
import {
  IngredientForm,
  applyFact,
  expandedAfterRemove,
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
      expect(next?.kcal).toBe(350);
      expect(FACTS.kcal).toBe(200);
    });

    it('ungueltige Pflichtwerte werden 0, optionale undefined', () => {
      expect(applyFact(FACTS, 'proteinG', 'abc')?.proteinG).toBe(0);
      expect(applyFact(FACTS, 'fiberG', 'abc')?.fiberG).toBeUndefined();
    });

    it('leeres oder ungueltiges kcal-Feld gilt als fehlend (keine Werte), nicht als 0 kcal', () => {
      expect(applyFact(FACTS, 'kcal', '')).toBeUndefined();
      expect(applyFact(FACTS, 'kcal', '  ')).toBeUndefined();
      expect(applyFact(FACTS, 'kcal', 'abc')).toBeUndefined();
    });

    it('klemmt negative Werte auf 0', () => {
      expect(applyFact(FACTS, 'kcal', '-5')?.kcal).toBe(0);
      expect(applyFact(FACTS, 'fatG', '-1,5')?.fatG).toBe(0);
      expect(applyFact(FACTS, 'fiberG', '-2')?.fiberG).toBe(0);
    });
  });

  describe('expandedAfterRemove', () => {
    it('bleibt ohne Auswahl leer', () => {
      expect(expandedAfterRemove(null, 1)).toBeNull();
    });
    it('klappt zu, wenn die aufgeklappte Zutat entfernt wird', () => {
      expect(expandedAfterRemove(2, 2)).toBeNull();
    });
    it('rutscht mit, wenn davor eine Zutat entfernt wird', () => {
      expect(expandedAfterRemove(3, 1)).toBe(2);
    });
    it('bleibt, wenn dahinter entfernt wird', () => {
      expect(expandedAfterRemove(1, 3)).toBe(1);
    });
  });

  describe('formFromRecipe / formFromImport', () => {
    it('formFromImport hat Standard 2 Portionen und einen leeren Schritt', () => {
      const form = formFromImport({ title: 'T', servings: 0, ingredients: [], steps: [] });
      expect(form.servings).toBe(2);
      expect(form.steps).toEqual(['']);
      expect(form.cookedWeightG).toBeNull();
    });

    it('formFromRecipe behandelt ein altes, nur berechnetes Gesamtgewicht wieder als Schaetzung', () => {
      const recipe = {
        id: 'r1', title: 'Reis', servings: 2, cookedWeightG: 200, steps: [],
        ingredients: [{ name: 'Reis', amount: 200, unit: 'g' }],
      } as unknown as Recipe;
      expect(formFromRecipe(recipe).cookedWeightG).toBeNull();
    });

    it('formFromRecipe behaelt ein abweichendes, von Hand eingegebenes Gewicht', () => {
      const recipe = {
        id: 'r1', title: 'Reis', servings: 2, cookedWeightG: 450, steps: [],
        ingredients: [{ name: 'Reis', amount: 200, unit: 'g' }],
      } as unknown as Recipe;
      expect(formFromRecipe(recipe).cookedWeightG).toBe(450);
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

    it('speichert das berechnete Gewicht nicht als eigenes Gewicht', () => {
      const form = { ...emptyForm(), title: 'X', servings: 2, ingredients: [ing({ amount: 200 })], steps: [' a ', ''] };
      const result = buildRecipeDraft(form, 'text');
      if ('error' in result) throw new Error(result.error);
      expect(result.draft.cookedWeightG).toBeUndefined();
      expect(result.draft.steps).toEqual(['a']);
      expect(result.draft.origin).toBe('text');
    });

    it('aendert sich die Schaetzung mit den Zutaten, wenn nichts von Hand eingegeben wurde', () => {
      const first = buildRecipeDraft({ ...emptyForm(), title: 'X', ingredients: [ing({ amount: 200 })] }, 'own');
      if ('error' in first) throw new Error(first.error);
      const reopened = formFromRecipe({ ...first.draft, id: 'r', createdAt: 'a', updatedAt: 'a' } as unknown as Recipe);
      const edited = { ...reopened, ingredients: [{ ...reopened.ingredients[0], amount: 400 }] };

      expect(cookedWeightValue(edited.cookedWeightG, 400)).toBe(400);
      expect(cookedWeightIsEstimate(edited.cookedWeightG, 400)).toBe(true);
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
