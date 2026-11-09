import { DiaryEntry, MealType, NutritionFacts, Recipe, SavedMeal } from '../../core/models';
import { NewDiaryEntry } from '../../core/state/diary.store';
import { countMissingFacts } from '../../recipes/recipe-view';
import { factsDiffer, isValidAmount, rebaseTo100, scaleFacts } from '../diary-helpers';

/** Zuletzt benutzten Eintrag unverändert erneut buchen. */
export function entryFromRecent(entry: DiaryEntry, dateISO: string, meal: MealType): NewDiaryEntry {
  return {
    dateISO,
    meal,
    label: entry.label,
    brand: entry.brand,
    ref: entry.ref,
    amountG: entry.amountG,
    servings: entry.servings,
    facts: entry.facts,
    baseFacts: entry.baseFacts,
    isEstimate: entry.isEstimate,
    isPartial: entry.isPartial,
    unit: entry.unit,
  };
}

/** Eine Portion eines Rezepts; null, wenn das Rezept keine Nährwerte je Portion hat. */
export function entryFromRecipe(recipe: Recipe, dateISO: string, meal: MealType): NewDiaryEntry | null {
  if (!recipe.factsPerServing) return null;
  return {
    dateISO,
    meal,
    label: recipe.title,
    ref: { kind: 'recipe', recipeId: recipe.id },
    servings: 1,
    facts: recipe.factsPerServing,
    isPartial: countMissingFacts(recipe.ingredients) > 0,
  };
}

/** Alle Einträge einer gespeicherten Mahlzeit in die gewählte Essenszeit. */
export function entriesFromSavedMeal(saved: SavedMeal, dateISO: string, meal: MealType): NewDiaryEntry[] {
  return saved.entries.map((e) => ({
    dateISO,
    meal,
    label: e.label,
    ref: e.ref,
    amountG: e.amountG,
    servings: e.servings,
    facts: e.facts,
  }));
}

/** Summe aus kcal und Eiweiß für die Bestätigung nach einem Schnell-Eintrag. */
export function sumEntryTotals(entries: readonly { facts: NutritionFacts }[]): { kcal: number; proteinG: number } {
  return entries.reduce(
    (sum, e) => ({ kcal: sum.kcal + (e.facts.kcal || 0), proteinG: sum.proteinG + (e.facts.proteinG || 0) }),
    { kcal: 0, proteinG: 0 },
  );
}

/** Eiweiß (g) einer gespeicherten Mahlzeit. */
export function savedMealProtein(meal: SavedMeal): number {
  return sumEntryTotals(meal.entries).proteinG;
}

/**
 * Bezugswerte für spätere Mengenänderung eines Gramm-Eintrags; bei manuell angepassten
 * Werten daraus neu abgeleitet, sonst bleibt die Quelle erhalten.
 */
export function baseFactsForSave(
  baseFacts: NutritionFacts | null,
  isPer100g: boolean,
  baseAmount: number | null,
  facts: NutritionFacts,
): NutritionFacts | undefined {
  if (!baseFacts || !isPer100g) return undefined;
  if (!isValidAmount(baseAmount)) return baseFacts;
  const scaled = scaleFacts(baseFacts, baseAmount / 100);
  return factsDiffer(scaled, facts) ? rebaseTo100(facts, baseAmount) : baseFacts;
}

export interface AddFormCheckInput {
  label: string;
  /** Quelle (Suche, Rezept) gewählt; Einheit der Bezugswerte. */
  sourceUnit: 'g' | 'portion' | null;
  baseAmount: number | null;
  servings: number | null;
  /** Rohe Mengeneingabe (nur bei manueller Eingabe relevant). */
  amountEntered: number | null;
  hasFacts: boolean;
}

export interface AddFormError {
  message: string;
  /** Die Nährwert-Gruppe soll geöffnet werden. */
  openAdjust: boolean;
}

/** Prüft das Eintragen-Formular in fester Reihenfolge; null = speicherbar. */
export function checkAddForm(i: AddFormCheckInput): AddFormError | null {
  if (!i.label) return { message: 'Der Name fehlt — gib ein, was du gegessen hast.', openAdjust: false };
  if (i.sourceUnit === 'g' && !isValidAmount(i.baseAmount)) {
    return { message: 'Die Menge fehlt — gib eine Menge größer als 0 ein.', openAdjust: false };
  }
  if (i.sourceUnit === 'portion' && !isValidAmount(i.servings)) {
    return { message: 'Die Portionen fehlen — gib eine Zahl größer als 0 ein.', openAdjust: false };
  }
  if (i.sourceUnit === null && i.amountEntered != null && !isValidAmount(i.baseAmount)) {
    return { message: 'Die Menge muss größer als 0 sein — oder lass das Feld leer.', openAdjust: false };
  }
  if (!i.hasFacts) {
    return { message: 'Die Kalorien fehlen — trage sie unter „Nährwerte anpassen“ ein.', openAdjust: true };
  }
  return null;
}
