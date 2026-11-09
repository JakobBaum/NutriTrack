import { displayName, nameKey } from './ingredient-name';
import { CLOVES_PER_BULB, MAX_PIECE_COUNT, spiceUnitFor } from './spice-rules';
import { normalizeUnit } from './shopping-units';
import { isUsUnit, spoonToMetric, toMetric } from './units/unit-convert';

/** Eine Zutat in der kanonischen (metrischen, plausiblen) Einkaufsform. */
export interface ShoppingIngredient {
  name: string;
  amount: number;
  unit: string;
  /** Gewürz/Kraut: Menge ist eine Kaufeinheit (1 Packung/Bund/Topf) und wird nie addiert. */
  spice: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function isGarlicClove(key: string, unit: string): boolean {
  return key.includes('knoblauch') && !key.includes('pulver') && (unit === 'Zehe' || key.includes('zehe'));
}

/**
 * Bringt eine Rezept-Zutat in die Form der Einkaufsliste: US-Maße metrisch, EL/TL in ml/g, Namen im Singular,
 * Gewürze und Kräuter als 1 Packung/Bund/Topf, Knoblauchzehen als Knollen, Stückzahlen auf einen plausiblen Wert begrenzt.
 */
export function normalizeIngredient(rawName: string, rawAmount: number, rawUnit: string): ShoppingIngredient {
  const name = displayName(rawName);
  const spiceUnit = spiceUnitFor(name);
  if (spiceUnit) return { name, amount: 1, unit: spiceUnit, spice: true };

  const us = isUsUnit(rawUnit) ? toMetric(rawAmount, rawUnit, name) : { amount: rawAmount, unit: rawUnit };
  const norm = normalizeUnit(us.amount, us.unit);
  const key = nameKey(name);

  if (isGarlicClove(key, norm.unit)) {
    const bulbs = Math.max(1, Math.ceil(norm.amount / CLOVES_PER_BULB - 1e-9));
    return { name: 'Knoblauch', amount: bulbs, unit: 'Stk', spice: false };
  }
  if (norm.unit === 'EL' || norm.unit === 'TL') {
    const metric = spoonToMetric(norm.amount, norm.unit, name);
    return { name, amount: round2(metric.amount), unit: metric.unit, spice: false };
  }
  if (norm.unit === 'Stk' && norm.amount > MAX_PIECE_COUNT) {
    return { name, amount: MAX_PIECE_COUNT, unit: 'Stk', spice: false };
  }
  return { name, amount: round2(norm.amount), unit: norm.unit, spice: false };
}
