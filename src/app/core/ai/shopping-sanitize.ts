import { ShoppingItem } from '../models';
import { ShoppingPlanResult } from './ai-provider';
import { boundedList, cleanText, isInRange, numberInRange, roundCents } from './sanitize-common';

/** Höchstens so viele Positionen und Gerichte werden aus einer KI-Antwort übernommen. */
export const MAX_SHOPPING_ITEMS = 100;
export const MAX_SUGGESTED_DISHES = 20;
const MAX_NAME_CHARS = 80;
const MAX_UNIT_CHARS = 20;
const MAX_NOTE_CHARS = 300;
const DEFAULT_UNIT = 'Stk';
/** Größte plausible Menge einer Position (z. B. 100000 g). */
export const MAX_SHOPPING_AMOUNT = 100000;
/** Teuerster plausibler Einzelpreis einer Position in EUR. */
export const MAX_SHOPPING_PRICE_EUR = 300;
/** Teuerste plausible Gesamtsumme in EUR. */
export const MAX_SHOPPING_TOTAL_EUR = 5000;

/** Meldung, wenn eine nicht-leere KI-Antwort keine brauchbare Position enthielt. */
export const SHOPPING_INVALID_MESSAGE =
  'Die KI-Antwort für die Einkaufsliste war unbrauchbar. Versuche es noch einmal.';

function cleanItem(raw: unknown): ShoppingItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = cleanText(r['name'], MAX_NAME_CHARS);
  if (!name || !isInRange(r['amount'], Number.EPSILON, MAX_SHOPPING_AMOUNT)) return null;
  const unit = cleanText(r['unit'], MAX_UNIT_CHARS) || DEFAULT_UNIT;
  const estPrice = numberInRange(r['estPrice'], 0, MAX_SHOPPING_PRICE_EUR);
  const base: ShoppingItem = { name, amount: r['amount'], unit, checked: false };
  return estPrice === undefined ? base : { ...base, estPrice };
}

function cleanDishes(raw: unknown): string[] {
  return boundedList(raw, MAX_SUGGESTED_DISHES)
    .map((d) => cleanText(d, MAX_NAME_CHARS))
    .filter((d): d is string => !!d);
}

/**
 * Prüft eine KI-Antwort (unbekannte Form) für die Einkaufsliste: Texte gekürzt und ohne Steuerzeichen,
 * Mengen und Preise endlich und in Grenzen, Listen begrenzt, unbekannte Felder und kaputte Positionen verworfen.
 */
export function sanitizeShoppingPlan(raw: unknown): ShoppingPlanResult {
  const obj = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const items = boundedList(obj['items'], MAX_SHOPPING_ITEMS)
    .map(cleanItem)
    .filter((i): i is ShoppingItem => i !== null);
  const summed = roundCents(items.reduce((sum, i) => sum + (i.estPrice ?? 0), 0));
  const note = cleanText(obj['note'], MAX_NOTE_CHARS) || undefined;
  return {
    items,
    suggestedDishes: cleanDishes(obj['suggestedDishes']),
    estTotal: numberInRange(obj['estTotal'], 0, MAX_SHOPPING_TOTAL_EUR) ?? summed,
    ...(note ? { note } : {}),
  };
}

/** True, wenn die rohe Antwort Positionen enthielt (dann ist ein leeres Ergebnis ein Fehler). */
export function hadShoppingItems(raw: unknown): boolean {
  const items = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)['items'] : undefined;
  return Array.isArray(items) && items.length > 0;
}
