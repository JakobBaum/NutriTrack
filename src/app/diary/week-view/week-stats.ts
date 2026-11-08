import { addDaysISO } from '../../core/util/date';

/** Eiweiß gilt als erreicht ab diesem Anteil des Ziels. */
export const PROTEIN_GOAL_SHARE = 0.9;
/** Kalorien-Korridor als Anteil des Ziels: etwas mehr Luft nach unten als nach oben. */
export const KCAL_CORRIDOR = { min: 0.85, max: 1.05 } as const;
/** So viele Tage schaut die Serie höchstens zurück. */
export const STREAK_LOOKBACK_DAYS = 60;
export const WEEK_DAYS = 7;

export interface DayTotals {
  readonly dateISO: string;
  readonly kcal: number;
  readonly proteinG: number;
  /** Mindestens ein Eintrag an diesem Tag. */
  readonly logged: boolean;
}

export interface DayTargets {
  readonly kcal: number;
  readonly proteinG: number;
}

export interface WeekSummary {
  readonly loggedDays: number;
  readonly avgKcal: number;
  readonly avgProteinG: number;
  readonly daysInGoal: number;
}

/** Tag im Ziel: Eiweiß mindestens 90 % des Ziels und Kalorien im Korridor; Tage ohne Einträge zählen nie. */
export function isDayInGoal(day: DayTotals, target: DayTargets): boolean {
  if (!day.logged || target.kcal <= 0 || target.proteinG <= 0) return false;
  const proteinOk = day.proteinG >= target.proteinG * PROTEIN_GOAL_SHARE;
  const kcalOk = day.kcal >= target.kcal * KCAL_CORRIDOR.min && day.kcal <= target.kcal * KCAL_CORRIDOR.max;
  return proteinOk && kcalOk;
}

/** Die letzten `count` Tage bis einschließlich `todayISO`, ältester zuerst. */
export function lastDays(todayISO: string, count: number = WEEK_DAYS): string[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(todayISO, i - (count - 1)));
}

/** Mittelwerte über die Tage mit Einträgen (leere Tage verfälschen das Mittel nicht) und Tage im Ziel. */
export function weekSummary(days: readonly DayTotals[], target: DayTargets): WeekSummary {
  const logged = days.filter((d) => d.logged);
  const mean = (pick: (d: DayTotals) => number): number =>
    logged.length === 0 ? 0 : Math.round(logged.reduce((sum, d) => sum + pick(d), 0) / logged.length);
  return {
    loggedDays: logged.length,
    avgKcal: mean((d) => d.kcal),
    avgProteinG: mean((d) => d.proteinG),
    daysInGoal: days.filter((d) => isDayInGoal(d, target)).length,
  };
}

/**
 * Serie: aufeinanderfolgende Tage im Ziel. Der heutige Tag ist noch offen und
 * unterbricht die Serie nicht, solange er nicht im Ziel ist.
 */
export function currentStreak(
  inGoal: (dateISO: string) => boolean,
  todayISO: string,
  maxBack: number = STREAK_LOOKBACK_DAYS,
): number {
  let day = inGoal(todayISO) ? todayISO : addDaysISO(todayISO, -1);
  let streak = 0;
  while (streak < maxBack && inGoal(day)) {
    streak += 1;
    day = addDaysISO(day, -1);
  }
  return streak;
}
