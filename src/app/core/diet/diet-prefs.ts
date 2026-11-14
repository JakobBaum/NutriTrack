import { DietForm, Intolerance, UserProfile } from '../models';
import {
  DIET_FORM_VALUES,
  INTOLERANCE_VALUES,
  MAX_DISLIKES,
  MAX_DISLIKE_EN_LENGTH,
  MAX_DISLIKE_LENGTH,
} from './diet-options';

/** Ernährungsangaben des Profils; `dislikesEn` ist parallel zu `dislikes` ('' = keine Übersetzung). */
export interface DietPrefs {
  readonly diet: DietForm;
  readonly intolerances: readonly Intolerance[];
  readonly dislikes: readonly string[];
  readonly dislikesEn: readonly string[];
}

export const EMPTY_DIET_PREFS: DietPrefs = { diet: '', intolerances: [], dislikes: [], dislikesEn: [] };

const ENGLISH_TERM_PATTERN = /^[\p{L}][\p{L} -]*$/u;
const DIET_FIELDS = ['diet', 'intolerances', 'dislikes', 'dislikesEn'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Trimmt, fasst Leerraum zusammen und kürzt auf die Maximallänge; '' für Unbrauchbares. */
export function normalizeDislike(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_DISLIKE_LENGTH).trim();
}

/** Prüft eine (z. B. von der KI gelieferte) englische Entsprechung; '' = verworfen. */
export function sanitizeEnglishTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const term = raw.trim().toLowerCase();
  return term.length > 0 && term.length <= MAX_DISLIKE_EN_LENGTH && ENGLISH_TERM_PATTERN.test(term) ? term : '';
}

function uniqueInOrder<T>(list: readonly T[]): T[] {
  return list.filter((v, i) => list.indexOf(v) === i);
}

function sanitizeDislikePairs(rawDislikes: unknown, rawEn: unknown): Pick<DietPrefs, 'dislikes' | 'dislikesEn'> {
  const english = asArray(rawEn);
  const seen = new Set<string>();
  const pairs = asArray(rawDislikes)
    .map((raw, index) => ({ term: normalizeDislike(raw), en: sanitizeEnglishTerm(english[index]) }))
    .filter(({ term }) => {
      const key = term.toLowerCase();
      if (term === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_DISLIKES);
  return { dislikes: pairs.map((p) => p.term), dislikesEn: pairs.map((p) => p.en) };
}

/** Bereinigt Ernährungsangaben aus unbekannter Quelle: Unbekanntes fällt weg, Längen sind begrenzt. */
export function sanitizeDietPrefs(raw: unknown): DietPrefs {
  if (!isRecord(raw)) return EMPTY_DIET_PREFS;
  const diet = DIET_FORM_VALUES.find((v) => v === raw['diet']) ?? '';
  const intolerances = uniqueInOrder(
    asArray(raw['intolerances']).filter((v): v is Intolerance => INTOLERANCE_VALUES.includes(v as Intolerance)),
  );
  return { diet, intolerances, ...sanitizeDislikePairs(raw['dislikes'], raw['dislikesEn']) };
}

/** Bereinigtes Profil; Profile ohne Ernährungsfelder bleiben unverändert, leere Felder werden weggelassen. */
export function sanitizeProfileDiet(profile: UserProfile): UserProfile {
  if (!isRecord(profile) || !DIET_FIELDS.some((f) => f in profile)) return profile;
  const clean = sanitizeDietPrefs(profile);
  const { diet: _d, intolerances: _i, dislikes: _l, dislikesEn: _e, ...rest } = profile;
  return { ...rest, ...dietFieldsForProfile(clean) };
}

/** Nur gesetzte Felder; leere Angaben werden nicht im Profil gespeichert. */
export function dietFieldsForProfile(prefs: DietPrefs): Partial<UserProfile> {
  return {
    ...(prefs.diet !== '' ? { diet: prefs.diet } : {}),
    ...(prefs.intolerances.length > 0 ? { intolerances: [...prefs.intolerances] } : {}),
    ...(prefs.dislikes.length > 0 ? { dislikes: [...prefs.dislikes], dislikesEn: [...prefs.dislikesEn] } : {}),
  };
}

/** Ernährungsangaben des Profils (leer ohne Profil). */
export function dietPrefsOf(profile: UserProfile | null): DietPrefs {
  return profile ? sanitizeDietPrefs(profile) : EMPTY_DIET_PREFS;
}

export function hasDietPrefs(prefs: DietPrefs): boolean {
  return prefs.diet !== '' || prefs.intolerances.length > 0 || prefs.dislikes.length > 0;
}

/** Ergänzt eine Abneigung; unverändert (gleiche Instanz) bei leerem Text, Duplikat oder voller Liste. */
export function addDislike(prefs: DietPrefs, text: string): DietPrefs {
  const term = normalizeDislike(text);
  const isDuplicate = prefs.dislikes.some((d) => d.toLowerCase() === term.toLowerCase());
  if (term === '' || isDuplicate || prefs.dislikes.length >= MAX_DISLIKES) return prefs;
  return { ...prefs, dislikes: [...prefs.dislikes, term], dislikesEn: [...prefs.dislikesEn, ''] };
}

/** Entfernt die Abneigung an `index` samt Übersetzung. */
export function removeDislike(prefs: DietPrefs, index: number): DietPrefs {
  if (index < 0 || index >= prefs.dislikes.length) return prefs;
  return {
    ...prefs,
    dislikes: prefs.dislikes.filter((_, i) => i !== index),
    dislikesEn: prefs.dislikesEn.filter((_, i) => i !== index),
  };
}

export function toggleIntolerance(prefs: DietPrefs, value: Intolerance): DietPrefs {
  const has = prefs.intolerances.includes(value);
  return { ...prefs, intolerances: has ? prefs.intolerances.filter((v) => v !== value) : [...prefs.intolerances, value] };
}
