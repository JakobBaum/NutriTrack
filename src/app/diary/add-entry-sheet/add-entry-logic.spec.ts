import { scaleFacts } from '../diary-helpers';
import { DiaryEntry, NutritionFacts, Recipe, SavedMeal } from '../../core/models';
import {
  baseFactsForSave,
  checkAddForm,
  entriesFromSavedMeal,
  entryFromRecent,
  entryFromRecipe,
  filterLoggableRecipes,
  resolveAdjustOpen,
  rebaseScaleBase,
  NO_RECIPE_FACTS_MESSAGE,
  savedMealProtein,
  sumEntryTotals,
} from './add-entry-logic';

const PER100: NutritionFacts = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5, basis: 'per100g' };
const DATE = '2026-11-09';

describe('eintragbare Rezepte', () => {
  const base = { servings: 1, ingredients: [], steps: [], createdAt: 'a', updatedAt: 'a' };
  const own = { ...base, id: 'o', title: 'Reis', origin: 'own' as const, factsPerServing: { kcal: 1, proteinG: 1, carbsG: 1, fatG: 1, basis: 'perPortion' as const } };
  const ref = { ...base, id: 'r', title: 'Linsensuppe', origin: 'online' as const, onlineRef: { source: 'spoonacular' as const, externalId: '4', savedAt: '2026-11-01T10:00:00.000Z' } };
  const noFacts = { ...base, id: 'n', title: 'Leer', origin: 'own' as const };

  it('nimmt Verweise auf, auch ohne gespeicherte Werte, und lässt eigene Rezepte ohne Werte weg', () => {
    expect(filterLoggableRecipes([own, ref, noFacts], '').map((r) => r.id)).toEqual(['o', 'r']);
  });

  it('filtert nach Titel ohne Groß-/Kleinschreibung', () => {
    expect(filterLoggableRecipes([own, ref], ' LINSEN ').map((r) => r.id)).toEqual(['r']);
  });
});

describe('add-entry-logic', () => {
  describe('entryFromRecent', () => {
    it('uebernimmt Menge, Werte und Marke, aber Tag und Essenszeit der Sitzung', () => {
      const src = {
        id: 'x', dateISO: '2026-01-01', meal: 'snack', label: 'Skyr', brand: 'Marke',
        ref: { kind: 'food' }, amountG: 150, facts: PER100, unit: 'g',
      } as unknown as DiaryEntry;
      const entry = entryFromRecent(src, DATE, 'dinner');
      expect(entry.dateISO).toBe(DATE);
      expect(entry.meal).toBe('dinner');
      expect(entry.amountG).toBe(150);
      expect(entry.brand).toBe('Marke');
    });
  });

  describe('entryFromRecipe', () => {
    const base = { id: 'r1', title: 'Suppe', ingredients: [] } as unknown as Recipe;

    it('liefert null ohne Nährwerte je Portion', () => {
      expect(entryFromRecipe(base, DATE, 'lunch')).toBeNull();
    });

    it('bucht eine Portion mit Rezept-Referenz', () => {
      const entry = entryFromRecipe({ ...base, factsPerServing: PER100 }, DATE, 'lunch');
      expect(entry?.servings).toBe(1);
      expect(entry?.ref).toEqual({ kind: 'recipe', recipeId: 'r1' });
      expect(entry?.isPartial).toBe(false);
    });

    it('markiert Rezepte mit Zutaten ohne Werte als unvollstaendig', () => {
      const recipe = { ...base, factsPerServing: PER100, ingredients: [{ name: 'A', amount: 1, unit: 'g' }] } as unknown as Recipe;
      expect(entryFromRecipe(recipe, DATE, 'lunch')?.isPartial).toBe(true);
    });
  });

  describe('Mahlzeit-Summen', () => {
    const meal = {
      id: 'm', name: 'M',
      entries: [
        { label: 'a', facts: { ...PER100, kcal: 100, proteinG: 5 } },
        { label: 'b', facts: { ...PER100, kcal: 50, proteinG: 2.5 } },
      ],
    } as unknown as SavedMeal;

    it('bucht jeden Eintrag in die gewaehlte Essenszeit', () => {
      const result = entriesFromSavedMeal(meal, DATE, 'snack');
      expect(result.length).toBe(2);
      expect(result.every((e) => e.meal === 'snack' && e.dateISO === DATE)).toBe(true);
    });

    it('summiert kcal und Eiweiss und behandelt fehlende Werte als 0', () => {
      expect(sumEntryTotals(meal.entries)).toEqual({ kcal: 150, proteinG: 7.5 });
      expect(sumEntryTotals([{ facts: { ...PER100, kcal: NaN, proteinG: 0 } }])).toEqual({ kcal: 0, proteinG: 0 });
      expect(savedMealProtein(meal)).toBe(7.5);
    });
  });

  describe('baseFactsForSave', () => {
    it('liefert undefined ohne Gramm-Basis', () => {
      expect(baseFactsForSave(null, false, 100, PER100)).toBeUndefined();
      expect(baseFactsForSave(PER100, false, 100, PER100)).toBeUndefined();
    });

    it('behaelt die Quelle bei ungueltiger Menge oder unveraenderten Werten', () => {
      expect(baseFactsForSave(PER100, true, null, PER100)).toBe(PER100);
      const scaled = { ...PER100, kcal: 400, proteinG: 20, carbsG: 40, fatG: 10 };
      expect(baseFactsForSave(PER100, true, 200, scaled)).toBe(PER100);
    });

    it('leitet die Basis neu ab, wenn die Werte angepasst wurden', () => {
      const edited = { ...PER100, kcal: 500, proteinG: 20, carbsG: 40, fatG: 10 };
      const result = baseFactsForSave(PER100, true, 200, edited);
      expect(result).not.toBe(PER100);
      expect(result?.basis).toBe('per100g');
      expect(result?.kcal).toBeCloseTo(250, 5);
    });
  });

  describe('checkAddForm', () => {
    const ok = { label: 'Reis', sourceUnit: 'g' as const, baseAmount: 100, servings: null, amountEntered: 100, hasFacts: true };

    it('akzeptiert ein vollstaendiges Formular', () => {
      expect(checkAddForm(ok)).toBeNull();
    });

    it('meldet zuerst den fehlenden Namen', () => {
      expect(checkAddForm({ ...ok, label: '', hasFacts: false })?.message).toMatch(/Name/);
    });

    it('verlangt bei Gramm-Quelle eine Menge groesser 0', () => {
      expect(checkAddForm({ ...ok, baseAmount: 0 })?.message).toMatch(/Menge fehlt/);
    });

    it('verlangt bei Portions-Quelle Portionen groesser 0', () => {
      const result = checkAddForm({ ...ok, sourceUnit: 'portion', servings: null });
      expect(result?.message).toMatch(/Portionen/);
    });

    it('erlaubt bei manueller Eingabe eine leere Menge, aber keine 0', () => {
      const manual = { ...ok, sourceUnit: null, baseAmount: null, amountEntered: null };
      expect(checkAddForm(manual)).toBeNull();
      expect(checkAddForm({ ...manual, baseAmount: 0, amountEntered: 0 })?.message).toMatch(/größer als 0/);
    });

    it('oeffnet die Naehrwert-Gruppe, wenn die Kalorien fehlen', () => {
      const result = checkAddForm({ ...ok, hasFacts: false });
      expect(result?.openAdjust).toBe(true);
      expect(result?.message).toMatch(/Kalorien/);
    });
  });

  describe('resolveAdjustOpen', () => {
    const group = {};
    it('übernimmt den Wert, wenn das Ereignis vom Akkordeon selbst kommt', () => {
      expect(resolveAdjustOpen({ target: group, currentTarget: group, detail: { value: 'adjust' } }, undefined)).toBe('adjust');
      expect(resolveAdjustOpen({ target: group, currentTarget: group, detail: { value: undefined } }, 'adjust')).toBeUndefined();
    });
    it('ignoriert ionChange eines Feldes im Bereich (sprudelt zum Akkordeon hoch)', () => {
      const input = {};
      expect(resolveAdjustOpen({ target: input, currentTarget: group, detail: { value: '21' } }, 'adjust')).toBe('adjust');
    });
    it('ignoriert den Schalter im Bereich (boolescher Wert)', () => {
      const toggle = {};
      expect(resolveAdjustOpen({ target: toggle, currentTarget: group, detail: { value: 'on' } }, 'adjust')).toBe('adjust');
    });
  });
});

describe('rebaseScaleBase (T1)', () => {
  const edited: NutritionFacts = { kcal: 245, proteinG: 12.3, carbsG: 30, fatG: 4, basis: 'perPortion' };

  it('rechnet von Hand angepasste Werte auf 100 g zurück, damit eine Mengenänderung sie nicht überschreibt', () => {
    const base = rebaseScaleBase(edited, 'g', 150, null);
    expect(base?.basis).toBe('per100g');
    expect(scaleFacts(base as NutritionFacts, 1.5).kcal).toBe(245);
    expect(scaleFacts(base as NutritionFacts, 3).kcal).toBe(490);
  });

  it('rechnet bei Portionen auf eine Portion zurück', () => {
    const base = rebaseScaleBase(edited, 'portion', null, 2);
    expect(base?.kcal).toBeCloseTo(122.5, 3);
  });

  it('liefert null ohne gültige Menge', () => {
    expect(rebaseScaleBase(edited, 'g', null, null)).toBeNull();
    expect(rebaseScaleBase(edited, 'portion', null, 0)).toBeNull();
  });
});

describe('Hinweis bei Rezept ohne Werte (F7)', () => {
  it('hat einen Text, der zum Anpassen rät', () => {
    expect(NO_RECIPE_FACTS_MESSAGE).toContain('Anpassen');
  });
});

describe('Gespeicherte Mahlzeit (T18)', () => {
  it('übernimmt Einheit und Teilwerte-Kennzeichen, wenn das Modell sie kennt', () => {
    const saved = { id: 's', name: 'x', createdAt: 'a', entries: [{ label: 'Milch', facts: PER100, amountG: 200, ref: { kind: 'manual' as const }, unit: 'ml' as const, isPartial: true }] } as unknown as SavedMeal;
    const [entry] = entriesFromSavedMeal(saved, DATE, 'lunch');
    expect(entry.unit).toBe('ml');
    expect(entry.isPartial).toBe(true);
  });
});
