import { NutritionFacts } from '../models';

/** Längste Beschreibung, die an die KI geht (Zeichen). */
export const MAX_MEAL_TEXT_CHARS = 500;
/** Höchstens so viele Zeilen je Antwort werden übernommen. */
export const MAX_MEAL_ITEMS = 12;

/** Meldung, wenn aus der Beschreibung nichts Brauchbares erkannt wurde. */
export const MEAL_NOTHING_RECOGNIZED_MESSAGE =
  'Nichts erkannt. Beschreib es genauer oder trag es von Hand ein.';

/**
 * Vertrag der Worker-Funktion `parseMeal` (siehe docs/review-3/PARSE-MEAL-VERTRAG.md).
 * Eingabe: `{ text }`. Ausgabe der Rohantwort: `{ items: WireMealItem[] }`, höchstens {@link MAX_MEAL_ITEMS}.
 */
export interface WireMealItem {
  name: string;
  /** Menge in der genannten Einheit (z. B. 2 bei "2 Semmeln"). */
  amount: number;
  /** Einheit der Menge (z. B. "Stk", "g", "Tasse"). */
  unit: string;
  /** Gesamtgewicht dieser Zeile in g oder ml. */
  portionG: number;
  /** Nährwerte je 100 g (bzw. 100 ml). */
  per100g: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

/** Geprüfte Zeile: nur bekannte Felder, Zahlen in Grenzen, `per100g` im App-Format. */
export interface ParsedMealItem {
  name: string;
  amount: number;
  unit: string;
  portionG: number;
  per100g: NutritionFacts;
  /** True, wenn kcal um mehr als 25 % von 4/4/9 aus den Makros abweichen (nur markiert, nie korrigiert). */
  isKcalDoubtful: boolean;
}

/** Ergebnis der Prüfung: übernommene Zeilen und Zahl der verworfenen. */
export interface MealParseResult {
  items: ParsedMealItem[];
  droppedCount: number;
}
