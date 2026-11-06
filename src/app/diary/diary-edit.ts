import { AmountUnit, DiaryEntry, MealType, NutritionFacts } from '../core/models';
import type { NewDiaryEntry } from '../core/state/diary.store';
import { isValidAmount, perServingFacts, quickAmounts, scaleFacts, unitFactor } from './diary-helpers';

/** Schrittweite der Menge-Buttons: g/ml 10, kg/l 0,05. */
const STEP_SMALL = 10;
const STEP_LARGE = 0.05;
/** Schrittweite und Minimum der Portionen. */
export const SERVINGS_STEP = 0.5;
const DECIMALS_FACTOR = 1000;
/** Maximal so viele Schnellwahl-Chips (gleich breit in einer Zeile). */
const MAX_CHIPS = 4;

export type StepDirection = 1 | -1;

const roundTo3 = (n: number): number => Math.round(n * DECIMALS_FACTOR) / DECIMALS_FACTOR;

export function amountStep(unit: AmountUnit): number {
  return unitFactor(unit) === 1 ? STEP_SMALL : STEP_LARGE;
}

/** Menge um einen Schritt ändern (nie unter einen Schritt; leer zählt als 0). */
export function stepAmount(value: number | null, unit: AmountUnit, direction: StepDirection): number {
  const step = amountStep(unit);
  const base = value != null && Number.isFinite(value) ? value : 0;
  return Math.max(step, roundTo3(base + direction * step));
}

/** Portionen um 0,5 ändern (Minimum 0,5). */
export function stepServings(value: number | null, direction: StepDirection): number {
  const base = value != null && Number.isFinite(value) ? value : 0;
  return Math.max(SERVINGS_STEP, roundTo3(base + direction * SERVINGS_STEP));
}

export interface AmountChip {
  value: number;
  /** True beim „wie zuletzt“-Chip (nur wenn der Wert nicht schon eine Vorgabe ist). */
  isLast: boolean;
}

/** Schnellwahl-Chips: Vorgaben, plus „zuletzt“ nur wenn abweichend (ersetzt dann die größte Vorgabe). */
export function amountChips(unit: AmountUnit, last: number | null): AmountChip[] {
  const presets = quickAmounts(unit);
  const chips = presets.map((value) => ({ value, isLast: false }));
  if (last == null || presets.some((p) => Math.abs(p - last) < 1e-9)) return chips;
  return [...chips.slice(0, MAX_CHIPS - 1), { value: last, isLast: true }];
}

const MEAL_SHORT: Record<MealType, string> = {
  breakfast: 'Früh',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snacks',
};

/** Kurzlabel der Mahlzeit für schmale Chips (320 px). */
export function mealShortLabel(type: MealType): string {
  return MEAL_SHORT[type];
}

export type EditMode = 'amount' | 'portion' | 'optional';

/** Welche Mengenzeile der Bearbeiten-Dialog zeigt. */
export function editModeFor(entry: DiaryEntry, editBase: NutritionFacts | null): EditMode {
  if (editBase) return 'amount';
  return isValidAmount(entry.servings) ? 'portion' : 'optional';
}

/** Eingabedaten zum Neuanlegen eines Eintrags aus einem bestehenden (Rückgängig, Portionen ändern). */
export function entryToInput(entry: DiaryEntry): NewDiaryEntry {
  return {
    dateISO: entry.dateISO,
    meal: entry.meal,
    label: entry.label,
    brand: entry.brand,
    ref: entry.ref,
    amountG: entry.amountG,
    servings: entry.servings,
    facts: entry.facts,
    baseFacts: entry.baseFacts,
    isEstimate: entry.isEstimate,
    isPartial: entry.isPartial,
    unit: entry.unit,
  };
}

/** Eintrag mit neuer Portionenzahl: Nährwerte von „je Portion“ neu skaliert. */
export function withServings(entry: DiaryEntry, servings: number): DiaryEntry {
  const perServing = perServingFacts(entry.facts, entry.servings);
  return { ...entry, servings, facts: scaleFacts(perServing, servings) };
}
