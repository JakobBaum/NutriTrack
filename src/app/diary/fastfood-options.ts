/** Optionen und reine Helfer des Fastfood-Helfers (Formular im Diary-Sheet). */

export interface FastFoodForm {
  restaurant: string;
  kcalBudget: number | null;
  moneyBudget: number | null;
  /** Freitext für KI/Mock, z. B. "viel Protein". */
  preference: string;
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
  { label: 'Viel Protein', value: 'viel Protein' },
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

/** Preference-Option zum gespeicherten String (Fallback: erste Option). */
export function preferenceValue(preference: string): string {
  return PREFERENCE_OPTIONS.find((o) => o.value === preference)?.value ?? PREFERENCE_OPTIONS[0].value;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
