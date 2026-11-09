import { densityOf } from './density';

/** Ergebnis einer Umrechnung in das metrische Speicherformat (g, ml oder unveränderte Zähleinheit). */
export interface MetricAmount {
  amount: number;
  unit: string;
  /** True, wenn die Umrechnung nur ungefähr stimmt (Volumen ohne bekannte Dichte). */
  approx: boolean;
}

export const G_PER_LB = 453.6;
export const G_PER_OZ = 28.35;
export const ML_PER_CUP = 240;
export const ML_PER_FL_OZ = 29.57;
export const ML_PER_EL = 15;
export const ML_PER_TL = 5;
export const CM_PER_INCH = 2.54;

type Kind = 'lb' | 'oz' | 'cup' | 'floz' | 'tbsp' | 'tsp';

const US_UNITS: Readonly<Record<string, Kind>> = {
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  cup: 'cup', cups: 'cup', tasse: 'cup', tassen: 'cup',
  'fl oz': 'floz', 'fl. oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz', floz: 'floz',
  tbsp: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
};

const round = (v: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Volumen (ml) einer Zutat in Gramm, wenn eine Dichte bekannt ist; sonst ml mit Näherungsmarke. */
function fromMl(ml: number, name: string): MetricAmount {
  const density = densityOf(name);
  if (density.gPerMl !== null) return { amount: round(ml * density.gPerMl, 1), unit: 'g', approx: false };
  return { amount: round(ml, 1), unit: 'ml', approx: density.approx };
}

function usKind(unit: string): Kind | undefined {
  return US_UNITS[unit.trim().toLowerCase().replace(/\.$/, '')];
}

/** True, wenn die Einheit ein US-Maß ist (lb, oz, cup, fl oz, tbsp, tsp), das umgerechnet werden muss. */
export function isUsUnit(unit: string): boolean {
  return usKind(unit) !== undefined;
}

/**
 * Rechnet US-Maße in g/ml um (lb 453,6 g, oz 28,35 g, cup 240 ml, fl oz 29,57 ml); Flüssigkeiten bleiben ml,
 * bekannte Zutaten gehen über die Dichte in g, der Rest wird 1:1 in ml gerechnet (`approx`).
 * tbsp/tsp ergeben die App-Einheiten EL/TL. Alles andere bleibt unverändert.
 */
export function toMetric(amount: number, unit: string, name = ''): MetricAmount {
  const kind = usKind(unit);
  if (!kind || !(amount > 0)) return { amount, unit: unit.trim(), approx: false };
  switch (kind) {
    case 'lb':
      return { amount: round(amount * G_PER_LB, 1), unit: 'g', approx: false };
    case 'oz':
      return { amount: round(amount * G_PER_OZ, 1), unit: 'g', approx: false };
    case 'floz':
      return fromMl(amount * ML_PER_FL_OZ, name);
    case 'cup':
      return fromMl(amount * ML_PER_CUP, name);
    case 'tbsp':
      return { amount: round(amount), unit: 'EL', approx: false };
    case 'tsp':
      return { amount: round(amount), unit: 'TL', approx: false };
  }
}

/** EL/TL in g bzw. ml für die Einkaufsliste (damit sie mit g/ml-Mengen derselben Ware zusammenfallen). */
export function spoonToMetric(amount: number, unit: 'EL' | 'TL', name: string): MetricAmount {
  const ml = amount * (unit === 'EL' ? ML_PER_EL : ML_PER_TL);
  return fromMl(ml, name);
}
