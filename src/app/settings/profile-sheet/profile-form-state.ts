import { ActivityLevel, Goal, Sex, UserProfile } from '../../core/models';
import { DEFAULT_RATE_KG_PER_WEEK } from '../../core/nutrition/nutrition-calc.service';
import {
  manualKcalError,
  manualKcalOf,
  manualProteinError,
  manualProteinPerKgOf,
} from '../../core/nutrition/manual-target';
import { formatDecimal, parseDecimal } from '../../core/util/number-input';

/** Unveränderlicher Zustand des Profilformulars; Änderungen erzeugen immer ein neues Objekt. */
export interface ProfileFormState {
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  readonly age: number | null;
  readonly sex: Sex;
  readonly activityLevel: ActivityLevel;
  readonly goal: Goal;
  readonly targetWeightKg: number | null;
  /** Tempo in kg pro Woche; bei „Halten“ ohne Wirkung. */
  readonly rateKgPerWeek: number;
  /** True, wenn Kalorien- und Eiweißziel manuell gesetzt werden. */
  readonly manual: boolean;
  readonly manualKcalText: string;
  /** Eiweißziel in g pro kg Körpergewicht als Text (Dezimalkomma). */
  readonly manualProteinText: string;
}

export interface RateChoice {
  readonly value: number;
  readonly label: string;
}

export interface ManualErrors {
  readonly kcal?: string;
  readonly protein?: string;
}

const RATE_CHOICES: Record<'lose' | 'gain', readonly RateChoice[]> = {
  lose: [
    { value: 0.25, label: 'langsam' },
    { value: 0.5, label: 'mittel' },
    { value: 0.75, label: 'zügig' },
  ],
  gain: [
    { value: 0.1, label: 'langsam' },
    { value: 0.25, label: 'mittel' },
    { value: 0.4, label: 'zügig' },
  ],
};

export const DEFAULT_SEX: Sex = 'male';
export const DEFAULT_ACTIVITY: ActivityLevel = 'moderate';

/** Wählbare Tempi für ein Ziel (bei „Halten“ keine). */
export function rateChoicesFor(goal: Goal): readonly RateChoice[] {
  return goal === 'maintain' ? [] : RATE_CHOICES[goal];
}

/** Behält ein passendes Tempo, sonst das nächstliegende des Ziels (ohne Wert: die Vorgabe). */
export function rateForGoal(goal: Goal, rate: number | null | undefined): number {
  const fallback = goal === 'gain' ? DEFAULT_RATE_KG_PER_WEEK.gain : DEFAULT_RATE_KG_PER_WEEK.lose;
  if (goal === 'maintain' || rate === null || rate === undefined || !Number.isFinite(rate)) return fallback;
  return RATE_CHOICES[goal].reduce<number>(
    (best, c) => (Math.abs(c.value - rate) < Math.abs(best - rate) ? c.value : best),
    fallback,
  );
}

export function emptyFormState(): ProfileFormState {
  return {
    weightKg: null, heightCm: null, age: null, sex: DEFAULT_SEX, activityLevel: DEFAULT_ACTIVITY,
    goal: 'maintain', targetWeightKg: null, rateKgPerWeek: DEFAULT_RATE_KG_PER_WEEK.lose,
    manual: false, manualKcalText: '', manualProteinText: '',
  };
}

/** Formularzustand aus dem gespeicherten Profil; ohne Profil ein leeres Formular. */
export function formStateFromProfile(p: UserProfile | null): ProfileFormState {
  if (!p) return emptyFormState();
  const kcal = manualKcalOf(p);
  const protein = manualProteinPerKgOf(p);
  return {
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    age: p.age,
    sex: p.sex,
    activityLevel: p.activityLevel,
    goal: p.goal,
    targetWeightKg: p.targetWeightKg ?? null,
    rateKgPerWeek: rateForGoal(p.goal, p.rateKgPerWeek),
    manual: kcal !== null || protein !== null,
    manualKcalText: kcal === null ? '' : formatDecimal(kcal),
    manualProteinText: protein === null ? '' : formatDecimal(protein),
  };
}

/** Fehler der manuellen Felder; leer, solange „Automatisch“ gewählt ist. */
export function manualErrors(state: ProfileFormState): ManualErrors {
  if (!state.manual) return {};
  const kcal = manualKcalError(state.manualKcalText);
  const protein = manualProteinError(state.manualProteinText);
  return { ...(kcal ? { kcal } : {}), ...(protein ? { protein } : {}) };
}

/** Schaltet auf manuell und füllt leere Felder mit den aktuellen Formelwerten vor. */
export function withManualEnabled(
  state: ProfileFormState,
  formula: { kcal: number; proteinG: number } | null,
): ProfileFormState {
  const perKg = formula && state.weightKg ? Math.round((formula.proteinG / state.weightKg) * 10) / 10 : null;
  return {
    ...state,
    manual: true,
    manualKcalText: state.manualKcalText || (formula ? formatDecimal(formula.kcal) : ''),
    manualProteinText: state.manualProteinText || (perKg === null ? '' : formatDecimal(perKg)),
  };
}

/**
 * Profil aus dem Formular, sobald Gewicht, Größe und Alter gesetzt sind (sonst null).
 * Ungültige manuelle Werte werden weggelassen, nie begrenzt.
 */
export function profileFromFormState(state: ProfileFormState, updatedAt: string): UserProfile | null {
  const { weightKg, heightCm, age } = state;
  if (weightKg === null || heightCm === null || age === null) return null;
  if (![weightKg, heightCm, age].every((n) => Number.isFinite(n) && n > 0)) return null;
  const kcal = state.manual ? parseDecimal(state.manualKcalText) : null;
  const protein = state.manual ? parseDecimal(state.manualProteinText) : null;
  const base: UserProfile = {
    weightKg, heightCm, age, sex: state.sex, activityLevel: state.activityLevel, goal: state.goal,
    rateKgPerWeek: state.goal === 'maintain' ? 0 : state.rateKgPerWeek,
    ...(state.targetWeightKg !== null ? { targetWeightKg: state.targetWeightKg } : {}),
    updatedAt,
  };
  const withKcal = kcal !== null && manualKcalError(state.manualKcalText) === null ? { ...base, manualKcal: kcal } : base;
  return protein !== null && manualProteinError(state.manualProteinText) === null
    ? { ...withKcal, manualProteinGPerKg: protein }
    : withKcal;
}
