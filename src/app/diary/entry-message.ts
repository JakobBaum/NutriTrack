import { MealType } from '../core/models';
import { formatNum } from '../shared/num.pipe';
import { mealLabel } from './diary-helpers';

/** Nährwerte, die die Bestätigung nennt. */
export interface EntryMessageFacts {
  readonly kcal: number;
  readonly proteinG: number;
}

/** Bestätigung nach dem Eintragen: "In Frühstück eingetragen · 250 kcal · 18 g Eiweiß". */
export function entryAddedMessage(meal: MealType, facts: EntryMessageFacts): string {
  return `In ${mealLabel(meal)} eingetragen · ${formatNum(facts.kcal, 0)} kcal · ${formatNum(facts.proteinG, 0)} g Eiweiß`;
}
