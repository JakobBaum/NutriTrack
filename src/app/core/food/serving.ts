import { parseDecimal } from '../util/number-input';

/** Kleinste und größte Portionsgröße (g/ml), die als Vorbelegung der Menge taugt. */
export const MIN_SERVING_G = 1;
export const MAX_SERVING_G = 1000;

/**
 * Portionsgröße aus Open Food Facts (`serving_quantity`) nur bei plausiblem Wert (1 bis 1000 g);
 * Packungsgrößen, 0, Texte und Tippfehler ergeben undefined (Aufrufer nimmt dann 100 g).
 */
export function plausibleServingG(raw: unknown): number | undefined {
  const value = parseDecimal(raw);
  if (value === null || value < MIN_SERVING_G || value > MAX_SERVING_G) return undefined;
  return value;
}
