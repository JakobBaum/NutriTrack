import { Goal } from '../models';

/** Unterhalb dieses BMI ist die Kombination aus Größe und Gewicht kaum plausibel. */
const BMI_IMPLAUSIBLE_LOW = 14;
/** Oberhalb dieses BMI ist die Kombination aus Größe und Gewicht kaum plausibel. */
const BMI_IMPLAUSIBLE_HIGH = 60;
/** Untergewicht nach WHO. */
const BMI_UNDERWEIGHT = 18.5;
/** Ab diesem BMI rechnet das Eiweißziel mit einem Referenzgewicht. */
const BMI_REFERENCE_WEIGHT = 30;
/** Die Formeln sind für Erwachsene gerechnet. */
const ADULT_AGE = 18;

export interface PlausibilityInput {
  weightKg: number;
  heightCm: number;
  age: number;
  goal: Goal;
}

export type ProfileNoteCode = 'minor' | 'implausible' | 'underweightLose' | 'referenceWeight';

export interface ProfileNote {
  code: ProfileNoteCode;
  text: string;
}

/** BMI (kg/m²) oder null bei ungültigen Werten. */
export function bmiOf(weightKg: number, heightCm: number): number | null {
  if (![weightKg, heightCm].every((v) => Number.isFinite(v) && v > 0)) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function ageNote(age: number): ProfileNote[] {
  if (!Number.isFinite(age) || age <= 0 || age >= ADULT_AGE) return [];
  return [{
    code: 'minor',
    text: 'Die Formeln sind für Erwachsene gerechnet. Unter 18 Jahren sind die Werte nur eine grobe Orientierung - sprich bei Bedarf mit einer Ärztin oder einem Arzt.',
  }];
}

function bmiNote(bmi: number | null, goal: Goal): ProfileNote[] {
  if (bmi === null) return [];
  if (bmi < BMI_IMPLAUSIBLE_LOW || bmi > BMI_IMPLAUSIBLE_HIGH) {
    return [{ code: 'implausible', text: 'Gewicht und Größe ergeben einen ungewöhnlichen BMI. Bitte prüfe deine Eingaben.' }];
  }
  if (bmi < BMI_UNDERWEIGHT && goal === 'lose') {
    return [{ code: 'underweightLose', text: 'Dein BMI liegt unter 18,5. Abnehmen wird bei Untergewicht nicht empfohlen - besprich dein Ziel mit einer Ärztin oder einem Arzt.' }];
  }
  if (bmi > BMI_REFERENCE_WEIGHT) {
    return [{ code: 'referenceWeight', text: 'Bei einem BMI über 30 rechnen wir das Eiweißziel mit einem Referenzgewicht (BMI 25) statt mit deinem Körpergewicht.' }];
  }
  return [];
}

/** Hinweise zu Alter und BMI für das Profilformular; leer bei unauffälligen Werten. */
export function profileNotes(input: PlausibilityInput): ProfileNote[] {
  return [...ageNote(input.age), ...bmiNote(bmiOf(input.weightKg, input.heightCm), input.goal)];
}
