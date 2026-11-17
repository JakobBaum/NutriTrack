/**
 * Prüfung eines geladenen oder importierten Profils (Review 3, Befund 6). Rein, wirft nie.
 * Pflichtfelder mit falschem Typ oder Wertebereich verwerfen das ganze Profil (es wird nichts erfunden),
 * unbrauchbare optionale Zahlen fallen weg, Ernährungsangaben werden bereinigt.
 */
import { ActivityLevel, Goal, Sex, UserProfile } from '../models';
import { sanitizeProfileDiet } from '../diet/diet-prefs';
import { DEFAULT_FASTFOOD_COUNTRY, parseFastfoodCountry } from '../ai/fastfood-countries';
import { MANUAL_KCAL_RANGE, MANUAL_PROTEIN_RANGE } from '../nutrition/manual-target';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../weight/weight-math';
import { Rec, isRec } from '../util/guards';

interface Range { readonly min: number; readonly max: number }

const SEXES: readonly Sex[] = ['male', 'female', 'diverse'];
const GOALS: readonly Goal[] = ['lose', 'maintain', 'gain'];
const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];

const WEIGHT_RANGE: Range = { min: MIN_WEIGHT_KG, max: MAX_WEIGHT_KG };
const HEIGHT_RANGE: Range = { min: 50, max: 260 };
const AGE_RANGE: Range = { min: 1, max: 120 };
const RATE_RANGE: Range = { min: 0, max: 2 };

/** Wertebereiche, die ein geladenes Profil einhalten muss (das Formular muss darin bleiben; Test in `profile-form.ranges.spec.ts`). */
export const PROFILE_LOAD_RANGES = {
  weightKg: WEIGHT_RANGE,
  heightCm: HEIGHT_RANGE,
  age: AGE_RANGE,
  rateKgPerWeek: RATE_RANGE,
} as const;
/** Ersatz für ein fehlendes oder ungültiges `updatedAt` (wird nur noch zur Anzeige der Aktualität genutzt). */
const FALLBACK_UPDATED_AT = '1970-01-01T00:00:00.000Z';

const inRange = (v: unknown, r: Range): v is number => typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const isValidIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Optionale Zahlenfelder; nur gesetzt, wenn der Wert im erlaubten Bereich liegt. */
function optionalNumbers(raw: Rec): Partial<UserProfile> {
  const out: Partial<Record<'rateKgPerWeek' | 'targetWeightKg' | 'manualKcal' | 'manualProteinGPerKg', number>> = {};
  if (inRange(raw['rateKgPerWeek'], RATE_RANGE)) out.rateKgPerWeek = raw['rateKgPerWeek'];
  if (inRange(raw['targetWeightKg'], WEIGHT_RANGE)) out.targetWeightKg = raw['targetWeightKg'];
  if (inRange(raw['manualKcal'], MANUAL_KCAL_RANGE)) out.manualKcal = raw['manualKcal'];
  if (inRange(raw['manualProteinGPerKg'], MANUAL_PROTEIN_RANGE)) out.manualProteinGPerKg = raw['manualProteinGPerKg'];
  return out;
}

/** Bereinigtes Profil oder `null`, wenn Pflichtfelder fehlen oder unbrauchbar sind. */
export function sanitizeProfile(raw: unknown): UserProfile | null {
  if (!isRec(raw)) return null;
  const { weightKg, heightCm, age, sex, activityLevel, goal } = raw;
  if (!inRange(weightKg, WEIGHT_RANGE) || !inRange(heightCm, HEIGHT_RANGE) || !inRange(age, AGE_RANGE)) return null;
  if (!oneOf(SEXES, sex) || !oneOf(ACTIVITY_LEVELS, activityLevel) || !oneOf(GOALS, goal)) return null;
  const base: UserProfile = {
    weightKg, heightCm, age, sex, activityLevel, goal,
    ...optionalNumbers(raw),
    ...(raw['diet'] !== undefined ? { diet: raw['diet'] as UserProfile['diet'] } : {}),
    ...(raw['intolerances'] !== undefined ? { intolerances: raw['intolerances'] as UserProfile['intolerances'] } : {}),
    ...(raw['dislikes'] !== undefined ? { dislikes: raw['dislikes'] as string[] } : {}),
    ...(raw['dislikesEn'] !== undefined ? { dislikesEn: raw['dislikesEn'] as string[] } : {}),
    ...(raw['fastfoodCountry'] !== undefined ? { fastfoodCountry: parseFastfoodCountry(raw['fastfoodCountry']) } : {}),
    updatedAt: isValidIso(raw['updatedAt']) ? raw['updatedAt'] : FALLBACK_UPDATED_AT,
  };
  return sanitizeProfileDiet(base);
}

/** Altes, in den App-Einstellungen gespeichertes Land: nur ein gültiges, von der Vorgabe abweichendes Land zählt. */
export function legacyFastfoodCountry(raw: unknown): string | null {
  const country = parseFastfoodCountry(raw);
  return raw === country && country !== DEFAULT_FASTFOOD_COUNTRY ? country : null;
}

/**
 * Übernimmt das alte Land einmalig ins Profil. Hat das Profil schon ein Land (auch die Vorgabe),
 * bleibt es unverändert (dieselbe Instanz), damit die Übernahme idempotent ist.
 */
export function withLegacyFastfoodCountry(profile: UserProfile, legacyRaw: unknown): UserProfile {
  const legacy = legacyFastfoodCountry(legacyRaw);
  if (profile.fastfoodCountry !== undefined || legacy === null) return profile;
  return { ...profile, fastfoodCountry: legacy };
}
