/** Einheiten-Normalisierung für die Einkaufsliste: g/kg, ml/l, EL/TL, Stk/Stück/Zehe zählen als gleiche Ware. */
import { nameKey } from './ingredient-name';

interface Measure {
  amount: number;
  unit: string;
}

const KILO_FACTOR = 1000;
const PIECE_UNITS = new Set(['stk', 'stück', 'stueck', 'stuck', 'st', 'piece', 'pieces']);

/** Schreibweise (klein) -> einheitliche Anzeige-Einheit. */
const UNIT_ALIASES: Readonly<Record<string, string>> = {
  gramm: 'g', gr: 'g', milliliter: 'ml', liter: 'l', kilogramm: 'kg',
  el: 'EL', esslöffel: 'EL', tl: 'TL', teelöffel: 'TL',
  zehe: 'Zehe', zehen: 'Zehe', prise: 'Prise', prisen: 'Prise',
  pck: 'Pck', packung: 'Pck', packungen: 'Pck', pkg: 'Pck', päckchen: 'Pck',
  dose: 'Dose', dosen: 'Dose', bund: 'Bund', topf: 'Topf', scheibe: 'Scheibe', scheiben: 'Scheibe',
};

/** Rechnet kg -> g, l -> ml und vereinheitlicht Stück zu "Stk", EL/TL/Zehe/Pck usw.; alles andere bleibt unverändert. */
export function normalizeUnit(amount: number, unit: string): Measure {
  const key = unit.trim().toLowerCase();
  const alias = UNIT_ALIASES[key] ?? key;
  if (alias === 'kg') return { amount: amount * KILO_FACTOR, unit: 'g' };
  if (alias === 'l') return { amount: amount * KILO_FACTOR, unit: 'ml' };
  if (PIECE_UNITS.has(key)) return { amount, unit: 'Stk' };
  if (alias === 'g' || alias === 'ml') return { amount, unit: alias };
  if (alias !== key || UNIT_ALIASES[key] !== undefined) return { amount, unit: alias };
  return { amount, unit: unit.trim() };
}

/** Menge in der normalisierten Einheit zurück in die Anzeige-Einheit (kg/l) rechnen. */
export function fromNormalized(amount: number, displayUnit: string): number {
  const key = displayUnit.trim().toLowerCase();
  return key === 'kg' || key === 'l' ? amount / KILO_FACTOR : amount;
}

/** Schlüssel einer Position: normalisierter Name (Singular, klein) + normalisierte Einheit (klein). */
export function itemKey(name: string, unit: string): string {
  return `${nameKey(name)}|${normalizeUnit(1, unit).unit.toLowerCase()}`;
}
