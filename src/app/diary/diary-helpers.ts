import { MealType, NutritionFacts } from '../core/models';

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

/** Skaliert Nährwerte mit einem Faktor (kcal ganzzahlig, Rest auf 0,1 g). Ergebnis ist immer `perPortion`. */
export function scaleFacts(base: NutritionFacts, factor: number): NutritionFacts {
  return {
    kcal: Math.round(base.kcal * factor),
    proteinG: roundTo1(base.proteinG * factor),
    carbsG: roundTo1(base.carbsG * factor),
    fatG: roundTo1(base.fatG * factor),
    fiberG: base.fiberG != null ? roundTo1(base.fiberG * factor) : undefined,
    sugarG: base.sugarG != null ? roundTo1(base.sugarG * factor) : undefined,
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
}

export const EMPTY_FIELDS: EntryFields = {
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
  sugarG: null,
};

export function fieldsFromFacts(facts: NutritionFacts): EntryFields {
  return {
    kcal: facts.kcal,
    proteinG: facts.proteinG,
    carbsG: facts.carbsG,
    fatG: facts.fatG,
    fiberG: facts.fiberG ?? null,
    sugarG: facts.sugarG ?? null,
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
    basis: 'perPortion',
  };
}

/** Wandelt Ionic-Eingaben (Zahl, String oder leer) in eine endliche Zahl oder null. */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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
    (a.sugarG ?? 0) !== (b.sugarG ?? 0)
  );
}
