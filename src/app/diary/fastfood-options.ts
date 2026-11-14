import { FastFoodSuggestion } from '../core/models';

/** Optionen und reine Helfer des Fastfood-Helfers (Formular im Diary-Sheet). */

export interface FastFoodForm {
  restaurant: string;
  kcalBudget: number | null;
  moneyBudget: number | null;
  /** Gewählte Kriterien (1 bis MAX_PREFERENCES), je ein Wert aus PREFERENCE_OPTIONS. */
  preferences: string[];
  /** Land, dessen Sortiment gilt. */
  country: string;
}

export const FASTFOOD_CHAINS: readonly string[] = [
  'McDonald’s', 'Burger King', 'KFC', 'Subway', 'Domino’s', 'Pizza Hut', 'Vapiano', 'Nordsee',
  'dean&david', 'L’Osteria', 'Five Guys', 'Taco Bell', 'Wienerwald', 'Le Burger',
];

/** Picker-Wert für "Anderes …" (Freitextfeld). */
export const OTHER_RESTAURANT = '__other__';

export interface PreferenceOption {
  readonly label: string;
  /** Bleibt der bestehende Preference-String der Anfrage. */
  readonly value: string;
}

export const PREFERENCE_OPTIONS: readonly PreferenceOption[] = [
  { label: 'Viel Eiweiß', value: 'viel Protein' },
  { label: 'Wenig Kalorien', value: 'wenig Kalorien' },
  { label: 'Wenig Zucker', value: 'wenig Zucker' },
  { label: 'Vegetarisch', value: 'vegetarisch' },
  { label: 'Günstig', value: 'günstig' },
  { label: 'Sättigend', value: 'sättigend' },
];

export const KCAL_RANGE = { min: 200, max: 1500, step: 50 } as const;
export const MONEY_RANGE = { min: 3, max: 30, step: 0.5, default: 10 } as const;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Rundet auf das Raster des Sliders und begrenzt auf den Bereich. */
export function snapToRange(value: number, range: { min: number; max: number; step: number }): number {
  const snapped = Math.round((value - range.min) / range.step) * range.step + range.min;
  return clamp(snapped, range.min, range.max);
}

/** Start-kcal-Budget: Rest des Tages, auf den Slider-Bereich begrenzt. */
export function defaultKcalBudget(remainingKcal: number): number {
  return snapToRange(Number.isFinite(remainingKcal) ? remainingKcal : KCAL_RANGE.max, KCAL_RANGE);
}

/** Picker-Wert für ein gespeichertes Restaurant (unbekannte Namen = "Anderes"). */
export function restaurantChoice(restaurant: string): string {
  return FASTFOOD_CHAINS.includes(restaurant) ? restaurant : OTHER_RESTAURANT;
}

/** Name, der an die Anfrage geht: Kette oder Freitext. */
export function resolveRestaurant(choice: string, custom: string): string {
  return choice === OTHER_RESTAURANT ? custom.trim() : choice;
}

/** Mindestens ein, höchstens so viele Kriterien gleichzeitig. */
export const MIN_PREFERENCES = 1;
export const MAX_PREFERENCES = 4;
/** Runden "Weitere Vorschläge" nach der ersten Suche. */
export const MAX_FASTFOOD_ROUNDS = 4;
/** Der ältere Worker kürzt "preference" bei 60 Zeichen; die Kurzfassung bleibt sicher darunter. */
export const PREFERENCE_TEXT_MAX_CHARS = 55;
/** Grenzen der Ausschlussliste (passend zum Worker: 20 Namen à 60 Zeichen). */
export const EXCLUDE_MAX_ITEMS = 20;
export const EXCLUDE_ITEM_MAX_CHARS = 60;
/** Vorschläge bis zu diesem Faktor über dem Budget gelten noch als im Budget (Rundung der KI). */
export const OVER_BUDGET_TOLERANCE = 1.05;

const PREFERENCE_VALUES: readonly string[] = PREFERENCE_OPTIONS.map((o) => o.value);

/** Auswahl nach Antippen eines Kriteriums: an/aus, nie unter 1 und nie über 4. */
export function togglePreference(current: readonly string[], value: string): string[] {
  if (current.includes(value)) {
    return current.length > MIN_PREFERENCES ? current.filter((v) => v !== value) : [...current];
  }
  return current.length < MAX_PREFERENCES ? [...current, value] : [...current];
}

/** Gültige, eindeutige Kriterien aus einem unbekannten Wert; Fallback: das erste Kriterium. */
export function sanitizePreferences(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const valid = list.filter((v, i): v is string => typeof v === 'string' && PREFERENCE_VALUES.includes(v) && list.indexOf(v) === i);
  const limited = valid.slice(0, MAX_PREFERENCES);
  return limited.length > 0 ? limited : [PREFERENCE_VALUES[0]];
}

/** Kurztext der Kriterien für das alte Feld "preference" (Worker ohne "preferences"). */
export function preferenceSummary(preferences: readonly string[]): string {
  const parts = [...preferences];
  while (parts.length > 1 && parts.join(', ').length > PREFERENCE_TEXT_MAX_CHARS) parts.pop();
  return parts.join(', ').slice(0, PREFERENCE_TEXT_MAX_CHARS);
}

const nameKey = (name: string): string => name.trim().toLowerCase();

/** Hängt neue Vorschläge an; doppelte Namen (ohne Groß-/Kleinschreibung) entfallen. */
export function mergeSuggestions(existing: readonly FastFoodSuggestion[], incoming: readonly FastFoodSuggestion[]): FastFoodSuggestion[] {
  const seen = new Set(existing.map((s) => nameKey(s.itemName)));
  const added = incoming.filter((s) => {
    const key = nameKey(s.itemName);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...existing, ...added];
}

/** Namen der bereits gezeigten Vorschläge für die Anfrage (neueste zuerst behalten, gekürzt). */
export function excludeNames(shown: readonly FastFoodSuggestion[]): string[] {
  return shown.map((s) => s.itemName.trim().slice(0, EXCLUDE_ITEM_MAX_CHARS)).slice(-EXCLUDE_MAX_ITEMS);
}

/** Liegt der Vorschlag über dem kcal-Budget (mit kleiner Toleranz)? */
export function isOverBudget(suggestion: FastFoodSuggestion, kcalBudget: number): boolean {
  return suggestion.facts.kcal > kcalBudget * OVER_BUDGET_TOLERANCE;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
