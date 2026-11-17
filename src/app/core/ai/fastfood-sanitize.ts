import { FastFoodSuggestion } from '../models';
import { assessKcal, isKcalFarAboveMacros } from '../food/facts-plausibility';
import { cleanText, isInRange } from './sanitize-common';

/** Höchstens so viele Vorschläge je KI-Antwort werden übernommen. */
export const MAX_SUGGESTIONS_PER_RESPONSE = 5;
const MAX_NAME_CHARS = 120;
const MAX_RATIONALE_CHARS = 300;
const KCAL_RANGE = { min: 0, max: 3000 } as const;
/** Bei 0 kcal (Wasser, Zero-Getränke) darf jedes Makro höchstens so viel Gramm haben (Rundung). */
const ZERO_KCAL_MAX_MACRO_G = 1;
const MACRO_MAX_G = 300;
const PRICE_MAX_EUR = 200;

/** Meldung, wenn eine nicht-leere KI-Antwort keinen brauchbaren Eintrag enthielt. */
export const FASTFOOD_INVALID_MESSAGE =
  'Die KI-Antwort war unbrauchbar. Versuche es noch einmal oder ändere die Auswahl leicht.';

function cleanFacts(raw: unknown): FastFoodSuggestion['facts'] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  if (!isInRange(f['kcal'], KCAL_RANGE.min, KCAL_RANGE.max)) return null;
  if (!isInRange(f['proteinG'], 0, MACRO_MAX_G)) return null;
  if (!isInRange(f['carbsG'], 0, MACRO_MAX_G)) return null;
  if (!isInRange(f['fatG'], 0, MACRO_MAX_G)) return null;
  const facts = { kcal: f['kcal'], proteinG: f['proteinG'], carbsG: f['carbsG'], fatG: f['fatG'], basis: 'perPortion' } as const;
  // 0 kcal ist nur mit Makros nahe 0 plausibel (Wasser, Zero-Getränke); sonst stimmt die Energie nicht.
  if (facts.kcal === 0 && Math.max(facts.proteinG, facts.carbsG, facts.fatG) > ZERO_KCAL_MAX_MACRO_G) return null;
  // Verwerfen: kcal klar unter oder klar über der Makro-Energie (auch 0/0/0 mit spürbaren kcal).
  // Alkohol ist bei Fastfood kein relevanter Fall, daher keine Ausnahme für Überschuss.
  if (assessKcal(facts) === 'wrong' || isKcalFarAboveMacros(facts)) return null;
  return facts;
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
 * Steuerzeichen, Zahlen endlich und in Grenzen, kcal passend zu den Makros (4/4/9: weder klar darunter noch
 * klar darüber, 0/0/0 mit spürbaren kcal fällt weg), höchstens 5 Einträge.
 */
export function sanitizeFastfoodSuggestions(raw: unknown): FastFoodSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(cleanSuggestion)
    .filter((s): s is FastFoodSuggestion => s !== null)
    .slice(0, MAX_SUGGESTIONS_PER_RESPONSE);
}
