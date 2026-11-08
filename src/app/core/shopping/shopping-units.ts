/** Einheiten-Normalisierung für die Einkaufsliste: g/kg, ml/l und Stk/Stück zählen als gleiche Ware. */

interface Measure {
  amount: number;
  unit: string;
}

const KILO_FACTOR = 1000;
const PIECE_UNITS = new Set(['stk', 'stück', 'stueck']);

/** Rechnet kg -> g, l -> ml und vereinheitlicht Stück zu "Stk"; alles andere bleibt unverändert. */
export function normalizeUnit(amount: number, unit: string): Measure {
  const key = unit.trim().toLowerCase();
  if (key === 'kg') return { amount: amount * KILO_FACTOR, unit: 'g' };
  if (key === 'l') return { amount: amount * KILO_FACTOR, unit: 'ml' };
  if (PIECE_UNITS.has(key)) return { amount, unit: 'Stk' };
  return { amount, unit: unit.trim() };
}

/** Menge in der normalisierten Einheit zurück in die Anzeige-Einheit (kg/l) rechnen. */
export function fromNormalized(amount: number, displayUnit: string): number {
  const key = displayUnit.trim().toLowerCase();
  return key === 'kg' || key === 'l' ? amount / KILO_FACTOR : amount;
}

/** Schlüssel einer Position: Name + normalisierte Einheit (klein geschrieben). */
export function itemKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${normalizeUnit(1, unit).unit.toLowerCase()}`;
}
