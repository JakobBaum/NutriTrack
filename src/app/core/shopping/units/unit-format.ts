import { G_PER_LB, G_PER_OZ, ML_PER_CUP, ML_PER_FL_OZ, isUsUnit, toMetric } from './unit-convert';

/** Einheitensystem der App (Einstellung `unitSystem`). */
export type UnitSystem = 'metric' | 'imperial';

export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

const GRAM_KILO = 1000;

/** Rundet auf das nächste Vielfache von `step`. */
function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Sinnvolle Rundungsschritte für Gramm und Milliliter (5er/10er/50er). */
function metricStep(value: number): number {
  if (value < 10) return 1;
  if (value < 50) return 5;
  if (value < 500) return 10;
  return 50;
}

function numberText(value: number, maxDigits = 2): string {
  return value.toLocaleString('de-AT', { maximumFractionDigits: maxDigits });
}

function metricText(amount: number, small: 'g' | 'ml', large: 'kg' | 'l'): string {
  if (amount >= GRAM_KILO) return `${numberText(roundTo(amount / GRAM_KILO, 0.05))} ${large}`;
  return `${numberText(roundTo(amount, metricStep(amount)))} ${small}`;
}

function imperialWeight(grams: number): string {
  if (grams >= G_PER_LB) return `${numberText(roundTo(grams / G_PER_LB, 0.1), 1)} lb`;
  const oz = grams / G_PER_OZ;
  return `${numberText(oz < 4 ? roundTo(oz, 0.5) : Math.round(oz), 1)} oz`;
}

function imperialVolume(ml: number): string {
  if (ml >= ML_PER_CUP / 2) return `${numberText(roundTo(ml / ML_PER_CUP, 0.25))} cups`;
  return `${numberText(roundTo(ml / ML_PER_FL_OZ, 0.5), 1)} fl oz`;
}

const IMPERIAL_LABEL: Readonly<Record<string, string>> = { EL: 'tbsp', TL: 'tsp' };

/**
 * Menge als Anzeigetext im gewählten System. Gespeichert wird immer metrisch (g, ml, EL, TL, Stk ...);
 * metrisch: g/kg und ml/l mit gerundeten Schritten, imperial: lb/oz und cups/fl oz, EL/TL als tbsp/tsp.
 * US-Maße (lb, cup ...) aus Altdaten werden vorher umgerechnet. Menge 0 ergibt nur die Einheit.
 */
export function formatQuantity(amount: number, unit: string, name: string, system: UnitSystem): string {
  const metric = isUsUnit(unit) ? toMetric(amount, unit, name) : { amount, unit: unit.trim() };
  const value = metric.amount;
  const u = metric.unit;
  if (!(value > 0)) return u;
  const key = u.toLowerCase();
  const mass = key === 'g' ? value : key === 'kg' ? value * GRAM_KILO : null;
  const volume = key === 'ml' ? value : key === 'l' ? value * GRAM_KILO : null;
  if (system === 'metric') {
    if (mass !== null) return metricText(mass, 'g', 'kg');
    if (volume !== null) return metricText(volume, 'ml', 'l');
  } else {
    if (mass !== null) return imperialWeight(mass);
    if (volume !== null) return imperialVolume(volume);
  }
  const label = system === 'imperial' ? IMPERIAL_LABEL[u] ?? u : u;
  return `${numberText(value)} ${label}`.trim();
}

/** Menge und Name als eine Zeile („900 g Schweinefleisch“). */
export function formatIngredientLine(amount: number, unit: string, name: string, system: UnitSystem): string {
  return `${formatQuantity(amount, unit, name, system)} ${name}`.trim();
}
