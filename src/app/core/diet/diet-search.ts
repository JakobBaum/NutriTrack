import { DietForm, Intolerance } from '../models';
import { DIET_FORM_OPTIONS, INTOLERANCE_OPTIONS } from './diet-options';
import { DietPrefs } from './diet-prefs';

/** Ernährungsfilter für Rezeptsuche und Wochenplan. */
export interface DietSearchPrefs {
  readonly diet: DietForm;
  readonly intolerances: readonly Intolerance[];
  /** Englische Begriffe für `excludeIngredients` (ohne leere Einträge). */
  readonly excludeIngredients: readonly string[];
  /** Deutsche und englische Begriffe für den Filter in der App. */
  readonly dislikeTerms: readonly string[];
}

export const NO_DIET_SEARCH: DietSearchPrefs = { diet: '', intolerances: [], excludeIngredients: [], dislikeTerms: [] };

export function dietSearchPrefs(prefs: DietPrefs): DietSearchPrefs {
  const english = prefs.dislikesEn.filter((en) => en !== '');
  return {
    diet: prefs.diet,
    intolerances: prefs.intolerances,
    excludeIngredients: english,
    dislikeTerms: [...prefs.dislikes, ...english],
  };
}

const labelOf = <T extends string>(options: readonly { value: T; label: string }[], value: T): string =>
  options.find((o) => o.value === value)?.label ?? value;

/** Kurze Zeile für die Profilübersicht (z. B. "Vegan · Gluten · 2 Abneigungen"); null ohne Angaben. */
export function describeDietPrefs(prefs: DietPrefs): string | null {
  const parts = [
    prefs.diet !== '' ? labelOf(DIET_FORM_OPTIONS, prefs.diet) : '',
    prefs.intolerances.map((v) => labelOf(INTOLERANCE_OPTIONS, v)).join(', '),
    prefs.dislikes.length > 0 ? `${prefs.dislikes.length} ${prefs.dislikes.length === 1 ? 'Abneigung' : 'Abneigungen'}` : '',
  ].filter((p) => p !== '');
  return parts.length > 0 ? parts.join(' · ') : null;
}
