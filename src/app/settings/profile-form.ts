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
  rateKgPerWeek: { min: 0.1, max: 1.5 },
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
