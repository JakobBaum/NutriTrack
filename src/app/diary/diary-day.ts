import { MealType } from '../core/models';
import { isIsoDate, isMealType } from './diary-helpers';

export interface DaySummary {
  totalKcal: number;
  totalProtein: number;
  targetKcal: number;
  targetProtein: number;
  /** Zum Ziel fehlende kcal (0, wenn erreicht, überschritten oder ohne Ziel). */
  remainingKcal: number;
  remainingProtein: number;
  /** Überschreitung in kcal (0 ohne Ziel). */
  overKcal: number;
}

/** Tageswerte fürs Tagebuch-Kopfkarte: gerundete Summen, Rest und Überschreitung. */
export function summarizeDay(
  totals: { kcal: number; proteinG: number },
  target: { kcal: number; proteinG: number } | null | undefined,
): DaySummary {
  const totalKcal = Math.round(totals.kcal);
  const totalProtein = Math.round(totals.proteinG);
  const targetKcal = target?.kcal ?? 0;
  const targetProtein = target?.proteinG ?? 0;
  return {
    totalKcal,
    totalProtein,
    targetKcal,
    targetProtein,
    remainingKcal: Math.max(0, targetKcal - totalKcal),
    remainingProtein: Math.max(0, targetProtein - totalProtein),
    overKcal: targetKcal > 0 ? Math.max(0, totalKcal - targetKcal) : 0,
  };
}

export interface DiaryQuery {
  /** Gültiger ISO-Tag aus `?date=`, sonst null. */
  date: string | null;
  /** `?add=` war gesetzt (Sheet öffnen); meal = gültige Essenszeit oder null (dann Tageszeit). */
  wantsAdd: boolean;
  addMeal: MealType | null;
  wantsFastfood: boolean;
  /** Gültige Essenszeit aus `?meal=` (Scroll-Ziel), sonst null. */
  scrollMeal: MealType | null;
  /** Mindestens ein Parameter war gesetzt (dann aus der URL entfernen). */
  hasAny: boolean;
}

interface ParamReader {
  get(name: string): string | null;
}

/** Liest die Deep-Link-Parameter des Tagebuchs, ohne etwas zu verändern. */
export function parseDiaryQuery(params: ParamReader): DiaryQuery {
  const add = params.get('add');
  const meal = params.get('meal');
  const date = params.get('date');
  const wantsFastfood = params.get('fastfood') === '1';
  return {
    date: isIsoDate(date) ? date : null,
    wantsAdd: !!add,
    addMeal: isMealType(add) ? add : null,
    wantsFastfood,
    scrollMeal: isMealType(meal) ? meal : null,
    hasAny: !!add || wantsFastfood || !!meal || !!date,
  };
}
