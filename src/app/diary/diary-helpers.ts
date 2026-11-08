import { formatNum } from '../shared/num.pipe';
import { AmountUnit, DiaryEntry, MealType, NutritionFacts } from '../core/models';
import { parseDecimal } from '../core/util/number-input';

export interface MealDef {
  readonly type: MealType;
  readonly label: string;
  readonly icon: string;
}

/** Mahlzeiten in Tagesreihenfolge (Anzeige im Tagebuch, Dashboard, Add-Modal). */
export const MEAL_DEFS: readonly MealDef[] = [
  { type: 'breakfast', label: 'Frühstück', icon: 'cafe-outline' },
  { type: 'lunch', label: 'Mittagessen', icon: 'sunny-outline' },
  { type: 'dinner', label: 'Abendessen', icon: 'moon-outline' },
  { type: 'snack', label: 'Snacks', icon: 'ice-cream-outline' },
];

const BREAKFAST_FROM_HOUR = 4;
const LUNCH_FROM_HOUR = 11;
const SNACK_FROM_HOUR = 15;
const DINNER_FROM_HOUR = 18;
const LATE_SNACK_FROM_HOUR = 22;

/** Mahlzeit, die zur Uhrzeit (0-23) am besten passt. */
export function mealForHour(hour: number): MealType {
  if (hour >= LATE_SNACK_FROM_HOUR || hour < BREAKFAST_FROM_HOUR) return 'snack';
  if (hour >= DINNER_FROM_HOUR) return 'dinner';
  if (hour >= SNACK_FROM_HOUR) return 'snack';
  if (hour >= LUNCH_FROM_HOUR) return 'lunch';
  return 'breakfast';
}

export function isMealType(value: string | null | undefined): value is MealType {
  return MEAL_DEFS.some((m) => m.type === value);
}

export function mealLabel(type: MealType): string {
  return MEAL_DEFS.find((m) => m.type === type)?.label ?? 'Tagebuch';
}

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const roundTo1 = (n: number): number => Math.round(n * 10) / 10;
const roundTo2 = (n: number): number => Math.round(n * 100) / 100;

/** Skaliert Nährwerte mit einem Faktor (kcal ganzzahlig, Rest auf 0,1 g). Ergebnis ist immer `perPortion`. */
export function scaleFacts(base: NutritionFacts, factor: number): NutritionFacts {
  return {
    kcal: Math.round(base.kcal * factor),
    proteinG: roundTo1(base.proteinG * factor),
    carbsG: roundTo1(base.carbsG * factor),
    fatG: roundTo1(base.fatG * factor),
    fiberG: base.fiberG != null ? roundTo1(base.fiberG * factor) : undefined,
    sugarG: base.sugarG != null ? roundTo1(base.sugarG * factor) : undefined,
    saltG: base.saltG != null ? roundTo2(base.saltG * factor) : undefined,
    basis: 'perPortion',
  };
}

/** Editierbare Nährwert-Felder des Add-Formulars (null = leer). */
export interface EntryFields {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  saltG: number | null;
}

export const EMPTY_FIELDS: EntryFields = {
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
  sugarG: null,
  saltG: null,
};

export function fieldsFromFacts(facts: NutritionFacts): EntryFields {
  return {
    kcal: facts.kcal,
    proteinG: facts.proteinG,
    carbsG: facts.carbsG,
    fatG: facts.fatG,
    fiberG: facts.fiberG ?? null,
    sugarG: facts.sugarG ?? null,
    saltG: facts.saltG ?? null,
  };
}

const orZero = (v: number | null): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;

/** Baut Nährwerte aus den Formularfeldern; `null`, wenn die Kalorien fehlen oder ungültig sind. */
export function factsFromFields(fields: EntryFields): NutritionFacts | null {
  const kcal = fields.kcal;
  if (typeof kcal !== 'number' || !Number.isFinite(kcal) || kcal < 0) return null;
  return {
    kcal: Math.round(kcal),
    proteinG: orZero(fields.proteinG),
    carbsG: orZero(fields.carbsG),
    fatG: orZero(fields.fatG),
    fiberG: orZero(fields.fiberG),
    sugarG: orZero(fields.sugarG),
    saltG: orZero(fields.saltG),
    basis: 'perPortion',
  };
}

/** Wandelt Ionic-Eingaben (Zahl, String oder leer) in eine endliche Zahl oder null. */
export function toNumberOrNull(value: unknown): number | null {
  // Zentrale Zahlen-Logik (Dezimalkomma, Tausenderpunkt, Leerzeichen -> null).
  return parseDecimal(value);
}

/**
 * Nährwerte je Portion aus einem Eintrag, dessen facts bereits für `servings`
 * Portionen gelten (verhindert doppelte Skalierung beim erneuten Anpassen).
 */
export function perServingFacts(facts: NutritionFacts, servings: number | null | undefined): NutritionFacts {
  return isValidAmount(servings) && servings !== 1 ? scaleFacts(facts, 1 / servings) : facts;
}

/**
 * Bezugswerte für den Bearbeiten-Dialog: gespeicherte baseFacts, sonst (manueller
 * Eintrag mit Menge) aus den Nährwerten auf 100 g/ml zurückgerechnet; ohne Menge null.
 */
export function editBaseFor(entry: DiaryEntry): NutritionFacts | null {
  if (entry.baseFacts) return entry.baseFacts;
  return isValidAmount(entry.amountG) ? rebaseTo100(entry.facts, entry.amountG) : null;
}

/**
 * Letzte Menge (Basiseinheit) für ein Lebensmittel nach Name, neueste zuerst;
 * Rezepte und der Eintrag `excludeId` (z. B. der gerade bearbeitete) zählen nicht.
 */
export function lastAmountForLabel(
  entries: readonly DiaryEntry[],
  label: string,
  excludeId?: string | null,
): number | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  const hit = [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .find(
      (e) =>
        e.id !== excludeId &&
        e.ref?.kind !== 'recipe' &&
        isValidAmount(e.amountG) &&
        e.label.trim().toLowerCase() === key,
    );
  return hit?.amountG ?? null;
}

const LIQUID_PATTERN =
  /(milch|saft|wasser|cola|limo|getränk|getraenk|bier|wein|tee\b|kaffee|drink|juice|milk|water|smoothie|schorle|shake|sprudel|brause|latte|cappuccino|espresso)/i;

/** Heuristik: Flüssigkeiten (nach Name) werden in ml statt g gemessen. */
export function unitForName(name: string): 'g' | 'ml' {
  return LIQUID_PATTERN.test(name) ? 'ml' : 'g';
}

/** True, wenn die Menge eine positive, endliche Zahl ist. */
export function isValidAmount(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Rechnet angepasste Nährwerte für `amount` zurück auf Werte pro 100 g (Basis für spätere Mengenänderung). */
export function rebaseTo100(facts: NutritionFacts, amount: number): NutritionFacts {
  return { ...scaleFacts(facts, 100 / amount), basis: 'per100g' };
}

/** True, wenn zwei Nährwert-Sätze sich in einem angezeigten Wert unterscheiden. */
export function factsDiffer(a: NutritionFacts, b: NutritionFacts): boolean {
  return (
    a.kcal !== b.kcal ||
    a.proteinG !== b.proteinG ||
    a.carbsG !== b.carbsG ||
    a.fatG !== b.fatG ||
    (a.fiberG ?? 0) !== (b.fiberG ?? 0) ||
    (a.sugarG ?? 0) !== (b.sugarG ?? 0) ||
    (a.saltG ?? 0) !== (b.saltG ?? 0)
  );
}

/** Auswählbare Mengeneinheiten im Tagebuch. */
export const AMOUNT_UNITS: readonly AmountUnit[] = ['g', 'kg', 'ml', 'l'];

const MAX_AMOUNT_DECIMALS = 3;
/** Anzeigegenauigkeit von Zahlenfeldern (6 Nachkommastellen). */
const INPUT_TEXT_PRECISION = 1e6;

/** Faktor von der Einheit in die Basiseinheit (kg/l -> 1000, sonst 1). */
export function unitFactor(unit: AmountUnit): number {
  return unit === 'kg' || unit === 'l' ? 1000 : 1;
}

/** Basiseinheit einer Einheit (g für g/kg, ml für ml/l). */
export function baseUnitOf(unit: AmountUnit): 'g' | 'ml' {
  return unit === 'ml' || unit === 'l' ? 'ml' : 'g';
}

const roundDecimals = (n: number): number => {
  const f = 10 ** MAX_AMOUNT_DECIMALS;
  return Math.round(n * f) / f;
};

/** Eingegebener Wert in `unit` -> Menge in Basiseinheit (g bzw. ml). */
export function toBaseAmount(value: number, unit: AmountUnit): number {
  return roundDecimals(value * unitFactor(unit));
}

/** Menge in Basiseinheit -> Wert in `unit` (max. 3 Nachkommastellen). */
export function fromBaseAmount(amountG: number, unit: AmountUnit): number {
  return roundDecimals(amountG / unitFactor(unit));
}

/**
 * Rechnet einen Mengenwert ungerundet von einer Einheit in eine andere um
 * (Einheitenwechsel im Formular; gerundet wird erst bei Anzeige/Speichern).
 */
export function convertAmount(value: number, from: AmountUnit, to: AmountUnit): number {
  return (value * unitFactor(from)) / unitFactor(to);
}

/** Menge für die Anzeige, z. B. „250 g“, „0,5 l“, „1,2 kg“ (Dezimalkomma). */
export function formatAmount(amountG: number, unit: AmountUnit = 'g'): string {
  return `${formatNum(fromBaseAmount(amountG, unit), MAX_AMOUNT_DECIMALS)} ${unit}`;
}

/** Chip-Beschriftung einer Menge: g/ml ohne Nachkommastellen („150“), kg/l mit bis zu 2 („0,25“). */
export function formatChipAmount(value: number, unit: AmountUnit): string {
  return formatNum(value, unitFactor(unit) === 1 ? 0 : 2);
}

const QUICK_AMOUNTS_SMALL: readonly number[] = [50, 100, 150, 200];
const QUICK_AMOUNTS_LARGE: readonly number[] = [0.1, 0.25, 0.5, 1];

/** Schnellwahl-Mengen in der gewählten Einheit (g/ml: 50-200, kg/l: 0,1-1). */
export function quickAmounts(unit: AmountUnit): readonly number[] {
  return unitFactor(unit) === 1 ? QUICK_AMOUNTS_SMALL : QUICK_AMOUNTS_LARGE;
}

/** Zahl als Eingabetext mit Dezimalkomma ('' bei null). */
export function numberToInputText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  // Nur für die Anzeige runden (Gleitkomma-Reste aus Einheitenwechseln ausblenden).
  const shown = Math.round(value * INPUT_TEXT_PRECISION) / INPUT_TEXT_PRECISION;
  return String(shown).replace('.', ',');
}

/**
 * Anzeigetext eines Zahlenfelds: der rohe Tipptext bleibt erhalten (z. B. "1,"),
 * solange er noch zum Zahlenwert passt, sonst die formatierte Zahl.
 */
export function inputTextFor(raw: string | undefined, value: number | null): string {
  if (raw !== undefined && toNumberOrNull(raw) === value) return raw;
  return numberToInputText(value);
}

/** Ob ein gespeicherter Eintrag zusätzlich als eigenes Lebensmittel gemerkt wird (nie bei Rezept, g-Treffer oder KI-Schätzung). */
export function shouldRememberAsCustomFood(opts: {
  recipeId: string | null | undefined;
  baseUnit: string | undefined;
  isEstimate: boolean;
}): boolean {
  return !opts.recipeId && opts.baseUnit !== 'g' && !opts.isEstimate;
}
