import { MAX_MEAL_TEXT_CHARS, ParsedMealItem } from '../../core/ai/meal-parse';
import { PORTION_RANGE_G } from '../../core/ai/meal-parse-sanitize';
import { MealType, NutritionFacts } from '../../core/models';
import type { NewDiaryEntry } from '../../core/state/diary.store';
import { stepAmount } from '../diary-edit';
import { numberToInputText, scaleFacts, toNumberOrNull } from '../diary-helpers';

/** Hinweis über der Ergebnisliste (Muster wie HEALTH_NOTES.fastfood; gehört bei Gelegenheit nach core/messages/health-notes.ts). */
export const DESCRIBE_NOTE = 'KI-Schätzung aus deiner Beschreibung. Allergene und Unverträglichkeiten werden nicht geprüft.';

const GRAMS_PER_100G = 100;

/** Zeile der Bestätigungsliste; die Menge in g ist änderbar, die Werte je 100 g bleiben fest. */
export interface MealRow {
  readonly id: string;
  readonly name: string;
  /** Gültige Menge in g oder null (leer, unlesbar, außerhalb 1 bis 2000). */
  readonly amountG: number | null;
  /** Tipptext des Mengenfelds (erhält z. B. "1," beim Tippen). */
  readonly amountText: string;
  /** Genannte Menge der Beschreibung ("2 Stk"), leer wenn sie nur Gramm wiederholt. */
  readonly quantityLabel: string;
  readonly per100g: NutritionFacts;
  readonly isKcalDoubtful: boolean;
}

export interface MealTotals {
  readonly kcal: number;
  readonly proteinG: number;
}

export type DescriptionCheck = 'empty' | 'ok' | 'tooLong';

/** Prüft den Text vor dem Senden (Rand wird nicht mitgezählt). */
export function checkDescription(text: string): DescriptionCheck {
  const length = text.trim().length;
  if (length === 0) return 'empty';
  return length > MAX_MEAL_TEXT_CHARS ? 'tooLong' : 'ok';
}

function validAmount(value: number | null): number | null {
  return value !== null && value >= PORTION_RANGE_G.min && value <= PORTION_RANGE_G.max ? value : null;
}

const amountTextOf = (grams: number): string => numberToInputText(grams);

const MAX_LABEL_CHARS = 60;

/** Name für den manuellen Eintrag aus der Beschreibung: getrimmt, an einer Wortgrenze gekürzt. */
export function labelFromDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_LABEL_CHARS) return trimmed;
  const cut = trimmed.slice(0, MAX_LABEL_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

function quantityLabelOf(item: ParsedMealItem): string {
  return item.unit.toLowerCase() === 'g' ? '' : `${item.amount} ${item.unit}`;
}

export function rowsFromItems(items: readonly ParsedMealItem[]): MealRow[] {
  return items.map((item, index) => ({
    id: `row-${index}`,
    name: item.name,
    amountG: item.portionG,
    amountText: amountTextOf(item.portionG),
    quantityLabel: quantityLabelOf(item),
    per100g: item.per100g,
    isKcalDoubtful: item.isKcalDoubtful,
  }));
}

export function withAmountText(row: MealRow, text: string): MealRow {
  return { ...row, amountText: text, amountG: validAmount(toNumberOrNull(text)) };
}

/** Menge um einen Schritt ändern (10 g, höchstens 2000 g). */
export function withSteppedAmount(row: MealRow, direction: 1 | -1): MealRow {
  const next = Math.min(PORTION_RANGE_G.max, stepAmount(row.amountG, 'g', direction));
  return withAmountText(row, amountTextOf(next));
}

export function removeRow(rows: readonly MealRow[], id: string): MealRow[] {
  return rows.filter((row) => row.id !== id);
}

function factsOf(row: MealRow): NutritionFacts | null {
  return row.amountG === null ? null : scaleFacts(row.per100g, row.amountG / GRAMS_PER_100G);
}

/** kcal und Eiweiß der Zeile bei aktueller Menge; ohne gültige Menge 0. */
export function rowTotals(row: MealRow): MealTotals {
  const facts = factsOf(row);
  return facts ? { kcal: facts.kcal, proteinG: facts.proteinG } : { kcal: 0, proteinG: 0 };
}

export function mealTotals(rows: readonly MealRow[]): MealTotals {
  return rows.reduce<MealTotals>(
    (sum, row) => {
      const t = rowTotals(row);
      return { kcal: sum.kcal + t.kcal, proteinG: Math.round((sum.proteinG + t.proteinG) * 10) / 10 };
    },
    { kcal: 0, proteinG: 0 },
  );
}

/** Eintragen ist nur mit mindestens einer Zeile und lauter gültigen Mengen möglich. */
export function canLogRows(rows: readonly MealRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.amountG !== null);
}

/** Ein Tagebucheintrag je gültiger Zeile; Werte sind KI-Schätzung, Bezugswerte je 100 g bleiben für spätere Änderungen. */
export function entriesFromRows(rows: readonly MealRow[], dateISO: string, meal: MealType): NewDiaryEntry[] {
  return rows.flatMap((row) => {
    const facts = factsOf(row);
    if (!facts || row.amountG === null) return [];
    return [{ dateISO, meal, label: row.name, amountG: row.amountG, unit: 'g' as const, facts, baseFacts: row.per100g, isEstimate: true }];
  });
}
