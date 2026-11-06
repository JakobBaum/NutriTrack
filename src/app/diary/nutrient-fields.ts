import { EntryFields } from './diary-helpers';

/** Atwater-Faktoren: kcal je g Eiweiß, Kohlenhydrate, Fett. */
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

const num = (v: number | null): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** True, wenn mindestens ein Makro-Feld (Eiweiß, KH, Fett) ausgefüllt ist. */
export function hasMacros(fields: Pick<EntryFields, 'proteinG' | 'carbsG' | 'fatG'>): boolean {
  return fields.proteinG != null || fields.carbsG != null || fields.fatG != null;
}

/** kcal aus den Makros: 4·Eiweiß + 4·KH + 9·Fett, ganzzahlig. */
export function kcalFromMacros(fields: Pick<EntryFields, 'proteinG' | 'carbsG' | 'fatG'>): number {
  return Math.round(
    KCAL_PER_G_PROTEIN * num(fields.proteinG) + KCAL_PER_G_CARBS * num(fields.carbsG) + KCAL_PER_G_FAT * num(fields.fatG),
  );
}

/** Felder mit aus den Makros berechneten kcal (unverändert, solange kein Makro eingetragen ist). */
export function withDerivedKcal(fields: EntryFields): EntryFields {
  return hasMacros(fields) ? { ...fields, kcal: kcalFromMacros(fields) } : fields;
}
