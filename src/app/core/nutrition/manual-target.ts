import { parseDecimal } from '../util/number-input';

/** Erlaubter Bereich für ein manuelles Kalorienziel (kcal pro Tag). */
export const MANUAL_KCAL_RANGE = { min: 1000, max: 6000 } as const;

/** Erlaubter Bereich für ein manuelles Eiweißziel (g pro kg Körpergewicht). */
export const MANUAL_PROTEIN_RANGE = { min: 1.2, max: 2.4 } as const;

/** Ab diesem Wert (g/kg) zeigt das Formular einen Hinweis, gesperrt wird erst ab dem Maximum. */
export const PROTEIN_NOTE_ABOVE_G_PER_KG = 2.2;

export interface ManualTargetFields {
  readonly manualKcal?: number;
  readonly manualProteinGPerKg?: number;
}

function inRange(value: unknown, range: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max;
}

/** Gespeichertes manuelles Kalorienziel oder null, wenn keines gesetzt oder der Wert unbrauchbar ist. */
export function manualKcalOf(p: ManualTargetFields): number | null {
  return inRange(p.manualKcal, MANUAL_KCAL_RANGE) ? p.manualKcal : null;
}

/** Gespeichertes manuelles Eiweißziel (g/kg) oder null. */
export function manualProteinPerKgOf(p: ManualTargetFields): number | null {
  return inRange(p.manualProteinGPerKg, MANUAL_PROTEIN_RANGE) ? p.manualProteinGPerKg : null;
}

/** Fehlertext für das Kalorienfeld; null = gültig. Es wird nie still begrenzt. */
export function manualKcalError(text: string): string | null {
  if (text.trim() === '') return 'Bitte einen Wert eingeben.';
  const value = parseDecimal(text);
  if (value === null) return 'Zahl eingeben, z. B. 2200.';
  return inRange(value, MANUAL_KCAL_RANGE) ? null : 'Das Kalorienziel muss zwischen 1.000 und 6.000 kcal liegen.';
}

/** Fehlertext für das Eiweißfeld (g/kg); null = gültig. */
export function manualProteinError(text: string): string | null {
  if (text.trim() === '') return 'Bitte einen Wert eingeben.';
  const value = parseDecimal(text);
  if (value === null) return 'Zahl eingeben, z. B. 2,0.';
  return inRange(value, MANUAL_PROTEIN_RANGE) ? null : 'Das Eiweißziel muss zwischen 1,2 und 2,4 g pro kg liegen.';
}

/** Hinweis (keine Sperre), wenn das manuelle Ziel unter der üblichen Mindestzufuhr liegt; null bei fehlendem oder unzulässigem Wert. */
export function manualKcalWarning(kcal: number | null, minimumKcal: number): string | null {
  if (!inRange(kcal, MANUAL_KCAL_RANGE) || kcal >= minimumKcal) return null;
  return `Unter der üblichen Mindestzufuhr von ${minimumKcal.toLocaleString('de-DE')} kcal. Das ist nur ein Hinweis.`;
}
