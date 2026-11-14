import { FastFoodSuggestion } from '../models';

/** Höchstens so viele Vorschläge je KI-Antwort werden übernommen. */
export const MAX_SUGGESTIONS_PER_RESPONSE = 5;
const MAX_NAME_CHARS = 120;
const MAX_RATIONALE_CHARS = 300;
const KCAL_RANGE = { min: 1, max: 3000 } as const;
const MACRO_MAX_G = 300;
const PRICE_MAX_EUR = 200;
/** kcal darf um diesen Anteil von 4*Eiweiß + 4*KH + 9*Fett abweichen (Ballaststoffe, Rundung). */
const ATWATER_TOLERANCE = 0.25;
/** Zusätzlicher fester Spielraum in kcal für sehr kleine Produkte. */
const ATWATER_SLACK_KCAL = 25;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Meldung, wenn eine nicht-leere KI-Antwort keinen brauchbaren Eintrag enthielt. */
export const FASTFOOD_INVALID_MESSAGE =
  'Die KI-Antwort war unbrauchbar. Versuche es noch einmal oder ändere die Auswahl leicht.';

function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function isInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function cleanFacts(raw: unknown): FastFoodSuggestion['facts'] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  if (!isInRange(f['kcal'], KCAL_RANGE.min, KCAL_RANGE.max)) return null;
  if (!isInRange(f['proteinG'], 0, MACRO_MAX_G)) return null;
  if (!isInRange(f['carbsG'], 0, MACRO_MAX_G)) return null;
  if (!isInRange(f['fatG'], 0, MACRO_MAX_G)) return null;
  const expected = KCAL_PER_G_PROTEIN * f['proteinG'] + KCAL_PER_G_CARBS * f['carbsG'] + KCAL_PER_G_FAT * f['fatG'];
  if (Math.abs(f['kcal'] - expected) > expected * ATWATER_TOLERANCE + ATWATER_SLACK_KCAL) return null;
  return { kcal: f['kcal'], proteinG: f['proteinG'], carbsG: f['carbsG'], fatG: f['fatG'], basis: 'perPortion' };
}

function cleanSuggestion(raw: unknown): FastFoodSuggestion | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const itemName = cleanText(r['itemName'], MAX_NAME_CHARS);
  const restaurant = cleanText(r['restaurant'], MAX_NAME_CHARS);
  const facts = cleanFacts(r['facts']);
  if (!itemName || !restaurant || !facts) return null;
  const rationale = cleanText(r['rationale'], MAX_RATIONALE_CHARS) ?? '';
  const price = r['estPrice'];
  return { restaurant, itemName, facts, rationale, estPrice: isInRange(price, 0, PRICE_MAX_EUR) ? price : undefined };
}

/**
 * Prüft eine KI-Antwort (unbekannte Form) und liefert nur plausible Vorschläge: Texte gekürzt und ohne
 * Steuerzeichen, Zahlen endlich und in Grenzen, kcal passend zu den Makros (4/4/9), höchstens 5 Einträge.
 */
export function sanitizeFastfoodSuggestions(raw: unknown): FastFoodSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(cleanSuggestion)
    .filter((s): s is FastFoodSuggestion => s !== null)
    .slice(0, MAX_SUGGESTIONS_PER_RESPONSE);
}
