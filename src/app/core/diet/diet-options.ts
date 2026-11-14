import { DietForm, Intolerance } from '../models';

/** Obergrenzen für die Abneigungen im Profil. */
export const MAX_DISLIKES = 15;
export const MAX_DISLIKE_LENGTH = 30;
/**
 * Obergrenze der Länge von `intolerances` und `excludeIngredients` als kommagetrennter Parameter (ganze Begriffe).
 * Muss mit RECIPE_LIST_MAX_CHARS in worker.js übereinstimmen; der Worker verwirft längere Werte komplett.
 */
export const MAX_FILTER_PARAM_CHARS = 200;
/** Obergrenze der (geprüften) englischen Entsprechung eines Begriffs. */
export const MAX_DISLIKE_EN_LENGTH = 40;

export interface DietOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** Ernährungsformen (Wert wie von Spoonacular erwartet). */
export const DIET_FORM_OPTIONS: readonly DietOption<DietForm>[] = [
  { value: '', label: 'Keine Vorgabe' },
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescetarian', label: 'Pescetarisch' },
  { value: 'gluten free', label: 'Glutenfrei' },
  { value: 'ketogenic', label: 'Keto' },
];

/** Unverträglichkeiten (feste Liste nach Spoonacular). */
export const INTOLERANCE_OPTIONS: readonly DietOption<Intolerance>[] = [
  { value: 'dairy', label: 'Milchprodukte' },
  { value: 'egg', label: 'Ei' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'peanut', label: 'Erdnuss' },
  { value: 'seafood', label: 'Fisch und Meeresfrüchte' },
  { value: 'shellfish', label: 'Schalentiere' },
  { value: 'soy', label: 'Soja' },
  { value: 'tree nut', label: 'Baumnüsse' },
  { value: 'wheat', label: 'Weizen' },
  { value: 'sesame', label: 'Sesam' },
];

export const DIET_FORM_VALUES: readonly DietForm[] = DIET_FORM_OPTIONS.map((o) => o.value);
export const INTOLERANCE_VALUES: readonly Intolerance[] = INTOLERANCE_OPTIONS.map((o) => o.value);

/** Hinweis zur Funktionsweise des Unverträglichkeiten-Filters in der App. */
export const INTOLERANCE_HINT = 'Es wird nach Zutatennamen gefiltert. Spuren und versteckte Zutaten werden nicht erkannt.';
export const DIET_HINT = 'Der Filter ist eine Hilfe und ersetzt nicht das Prüfen der Zutaten.';
