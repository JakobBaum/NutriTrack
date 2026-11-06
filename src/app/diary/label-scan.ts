import { NutritionFacts } from '../core/models';
import { LabelOcrService } from '../core/scan/label-ocr.service';
import { LabelField, ParsedNutritionLabel, parseNutritionLabel } from '../core/scan/nutrition-label-parser';

/** Mindestens so viele der drei Makros (Fett, Kohlenhydrate, Eiweiß) müssen gelesen sein. */
const MIN_MACROS = 2;
const MACRO_FIELDS: readonly LabelField[] = ['fatG', 'carbsG', 'proteinG'];
/** Felder, die im Formular als "fehlt" markiert werden. */
const REPORTED_FIELDS: readonly LabelField[] = ['fatG', 'carbsG', 'proteinG', 'fiberG', 'sugarG'];

const FIELD_NAMES: Record<LabelField, string> = {
  kcal: 'Kalorien',
  fatG: 'Fett',
  saturatedFatG: 'gesättigte Fettsäuren',
  carbsG: 'Kohlenhydrate',
  sugarG: 'Zucker',
  fiberG: 'Ballaststoffe',
  proteinG: 'Eiweiß',
  saltG: 'Salz',
};

export const LABEL_READ_HINT = 'Vom Etikett gelesen — bitte prüfen';
export const LABEL_FAILED_MESSAGE =
  'Das Etikett konnte nicht zuverlässig gelesen werden — mach ein schärferes Foto oder trage die Werte manuell ein.';

export type LabelScanOutcome =
  | { ok: true; facts: NutritionFacts; missing: LabelField[]; hint: string }
  | { ok: false; message: string };

/** True, wenn kcal und mindestens zwei Makros gefunden wurden. */
export function isUsableLabel(parsed: ParsedNutritionLabel): boolean {
  const macros = MACRO_FIELDS.filter((f) => parsed.found.includes(f)).length;
  return parsed.found.includes('kcal') && macros >= MIN_MACROS;
}

/** Fehlende Formularfelder in fester Reihenfolge. */
export function missingFields(parsed: ParsedNutritionLabel): LabelField[] {
  return REPORTED_FIELDS.filter((f) => !parsed.found.includes(f));
}

export function missingHint(missing: readonly LabelField[]): string {
  if (missing.length === 0) return LABEL_READ_HINT;
  return `${LABEL_READ_HINT}. Nicht gefunden: ${missing.map((f) => FIELD_NAMES[f]).join(', ')}.`;
}

/** Bewertet ein Parse-Ergebnis: fertige Nährwerte oder eine klare Fehlermeldung. */
export function evaluateLabelParse(parsed: ParsedNutritionLabel): LabelScanOutcome {
  if (!isUsableLabel(parsed)) return { ok: false, message: LABEL_FAILED_MESSAGE };
  const v = parsed.values;
  const missing = missingFields(parsed);
  const facts: NutritionFacts = {
    kcal: v.kcal ?? 0,
    proteinG: v.proteinG ?? 0,
    carbsG: v.carbsG ?? 0,
    fatG: v.fatG ?? 0,
    fiberG: v.fiberG,
    sugarG: v.sugarG,
    saltG: v.saltG,
    basis: parsed.basis === 'perPortion' ? 'perPortion' : 'per100g',
  };
  return { ok: true, facts, missing, hint: missingHint(missing) };
}

/** Formularfelder, die geleert werden sollen, weil der Wert nicht gelesen wurde. */
export function blankFieldsFor(missing: readonly LabelField[]): Partial<Record<'proteinG' | 'carbsG' | 'fatG', null>> {
  const out: Partial<Record<'proteinG' | 'carbsG' | 'fatG', null>> = {};
  for (const f of missing) {
    if (f === 'proteinG' || f === 'carbsG' || f === 'fatG') out[f] = null;
  }
  return out;
}

/** OCR + Parser; ein OCR-Fehler zählt wie "nicht lesbar". */
export async function readLabelOffline(ocr: LabelOcrService, base64: string): Promise<LabelScanOutcome> {
  try {
    return evaluateLabelParse(parseNutritionLabel(await ocr.recognizeText(base64)));
  } catch {
    return { ok: false, message: LABEL_FAILED_MESSAGE };
  }
}
