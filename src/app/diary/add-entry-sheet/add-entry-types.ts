import { AmountUnit, MealType, NutritionFacts } from '../../core/models';
import { EMPTY_FIELDS, EntryFields } from '../diary-helpers';

export type AddView = 'search' | 'form' | 'recipes' | 'saved' | 'meals' | 'describe';
export type QuantityUnit = 'g' | 'portion';

/** Bezugswerte, aus denen die Formularfelder bei Mengenänderung neu berechnet werden. */
export interface ScaleBase {
  facts: NutritionFacts;
  unit: QuantityUnit;
}

export interface EntryForm extends EntryFields {
  label: string;
  meal: MealType;
  amountG: number | null;
  servings: number | null;
}

export interface ApplyOptions {
  amountG?: number;
  unit?: AmountUnit;
  servings?: number;
  recipeId?: string;
  isAi?: boolean;
  isPartial?: boolean;
  hint?: string;
  brand?: string;
  /** Plausible Packungsportion in g/ml (Vorbelegung der Menge und Chip). */
  servingG?: number;
}

export const EMPTY_FORM: EntryForm = {
  ...EMPTY_FIELDS,
  label: '',
  meal: 'breakfast',
  amountG: null,
  servings: null,
};

export const DEFAULT_AMOUNT_G = 100;
export const MAX_RECENT_FOODS = 8;
export const SEARCH_FOCUS_DELAY_MS = 60;
/** Kurze Sperre nach einem Schnell-Eintrag gegen versehentliches Doppeltippen (das Sheet bleibt offen). */
export const QUICK_ADD_LOCK_MS = 400;
/** Name, wenn nur Kalorien (und ggf. Makros) eingetragen werden. */
export const QUICK_ENTRY_LABEL = 'Schnell-Eintrag';
export const AMOUNT_FOCUS_DELAY_MS = 150;
/** Wartezeit, bis das aufgeklappte „Nährwerte anpassen“ gerendert ist, bevor es in den Blick gescrollt wird. */
export const ADJUST_SCROLL_DELAY_MS = 120;
/** rawTexts-Schlüssel des Add-Formulars (Menge, Portionen, Nährwerte). */
export const ADD_FORM_TEXT_KEYS: readonly string[] = ['amount', 'servings', ...Object.keys(EMPTY_FIELDS)];
