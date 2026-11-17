import { NutritionFacts } from '../models';

/**
 * Gemeinsame Energie-Prüfung gegen die Makros (Open-Food-Facts-Filter und Rezept-Abgleich nutzen dieselbe Regel).
 * Ballaststoffe, Alkohol und Polyole machen kcal höher oder niedriger als 4/4/9; Eiweiß und Fett liefern aber
 * immer ihre Energie. Darum zählt nur "kcal klar unter der Energie aus Eiweiß und Fett" als sicher falsch.
 */

/** Mindestanteil der Makro-Energie, den die kcal-Angabe erreichen muss. */
export const MIN_KCAL_SHARE = 0.7;
/** Fester Spielraum (kcal) für Rundung und winzige Werte. */
export const MIN_KCAL_SLACK = 10;

/** Energie, die nie verschwinden kann: 4 kcal je g Eiweiß und 9 kcal je g Fett. */
export function protFatKcal(f: Pick<NutritionFacts, 'proteinG' | 'fatG'>): number {
  return 4 * (f.proteinG || 0) + 9 * (f.fatG || 0);
}

/** True, wenn kcal klar unter der Energie aus Eiweiß und Fett liegt (z. B. 0 kcal bei 50 g Fett). */
export function isKcalBelowProtFat(f: Pick<NutritionFacts, 'kcal' | 'proteinG' | 'fatG'>): boolean {
  return (f.kcal || 0) < protFatKcal(f) * MIN_KCAL_SHARE - MIN_KCAL_SLACK;
}
