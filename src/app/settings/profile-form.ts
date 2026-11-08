import { Goal } from '../core/models';
import { bmiOf } from '../core/nutrition/profile-plausibility';

/** Feldnamen des Bedarfs-Berechners, die eine Zahl brauchen. */
export type ProfileField = 'weightKg' | 'heightCm' | 'age' | 'rateKgPerWeek';

export interface ProfileFormValues {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  rateKgPerWeek: number | null;
}

export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

const RANGES: Record<ProfileField, { min: number; max: number }> = {
  weightKg: { min: 30, max: 300 },
  heightCm: { min: 100, max: 250 },
  age: { min: 14, max: 100 },
  rateKgPerWeek: { min: 0.1, max: 0.75 },
};

/** Reihenfolge der Felder im Formular (für den Fokus auf das erste fehlerhafte Feld). */
export const PROFILE_FIELD_ORDER: readonly ProfileField[] = ['weightKg', 'heightCm', 'age', 'rateKgPerWeek'];

function fieldError(field: ProfileField, value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return 'Bitte eine Zahl eingeben.';
  const { min, max } = RANGES[field];
  return value < min || value > max ? `Der Wert muss zwischen ${min} und ${max} liegen.` : null;
}

/** Liefert pro fehlerhaftem Feld eine deutsche Meldung; `rateKgPerWeek` zählt nur bei `needsRate`. */
export function validateProfileForm(values: ProfileFormValues, needsRate: boolean): ProfileFieldErrors {
  const fields = needsRate ? PROFILE_FIELD_ORDER : PROFILE_FIELD_ORDER.filter((f) => f !== 'rateKgPerWeek');
  return fields.reduce<ProfileFieldErrors>((acc, field) => {
    const message = fieldError(field, values[field]);
    return message ? { ...acc, [field]: message } : acc;
  }, {});
}

const TARGET_RANGE = { min: 30, max: 300 } as const;
/** Zielgewichte unter diesem BMI liegen im Untergewicht (WHO). */
const TARGET_MIN_BMI = 18.5;

/** Prüft das optionale Zielgewicht; null = in Ordnung (auch leer). */
export function targetWeightError(
  target: number | null,
  weightKg: number | null,
  goal: Goal,
  heightCm: number | null,
): string | null {
  if (target === null) return null;
  if (!Number.isFinite(target)) return 'Bitte eine Zahl eingeben.';
  if (target < TARGET_RANGE.min || target > TARGET_RANGE.max) {
    return `Das Zielgewicht muss zwischen ${TARGET_RANGE.min} und ${TARGET_RANGE.max} kg liegen.`;
  }
  if (weightKg !== null && goal === 'lose' && target >= weightKg) {
    return 'Zum Abnehmen muss das Zielgewicht unter deinem Gewicht liegen.';
  }
  if (weightKg !== null && goal === 'gain' && target <= weightKg) {
    return 'Zum Zunehmen muss das Zielgewicht über deinem Gewicht liegen.';
  }
  const bmi = heightCm === null ? null : bmiOf(target, heightCm);
  if (bmi !== null && bmi < TARGET_MIN_BMI) {
    return 'Das Zielgewicht liegt im Untergewicht (BMI unter 18,5). Wähle einen höheren Wert.';
  }
  return null;
}
