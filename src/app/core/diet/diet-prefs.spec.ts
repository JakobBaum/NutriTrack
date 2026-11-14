import { describe, expect, it } from 'vitest';
import { UserProfile } from '../models';
import {
  EMPTY_DIET_PREFS,
  addDislike,
  dietPrefsOf,
  hasDietPrefs,
  removeDislike,
  sanitizeDietPrefs,
  sanitizeEnglishTerm,
  sanitizeProfileDiet,
  toggleIntolerance,
} from './diet-prefs';
import { MAX_DISLIKES, MAX_DISLIKE_LENGTH } from './diet-options';

const BASE_PROFILE: UserProfile = {
  weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '2026-01-01T00:00:00.000Z',
};

const manyTerms = (count: number): string[] => Array.from({ length: count }, (_, i) => `Zutat${String.fromCharCode(97 + i)}`);

describe('sanitizeDietPrefs', () => {
  it('gibt für fehlende oder falsche Eingaben leere Werte zurück', () => {
    expect(sanitizeDietPrefs(undefined)).toEqual(EMPTY_DIET_PREFS);
    expect(sanitizeDietPrefs('x')).toEqual(EMPTY_DIET_PREFS);
    expect(sanitizeDietPrefs({ diet: 5, intolerances: 'gluten', dislikes: {} })).toEqual(EMPTY_DIET_PREFS);
  });

  it('verwirft unbekannte Ernährungsformen und Unverträglichkeiten', () => {
    const result = sanitizeDietPrefs({ diet: 'carnivore', intolerances: ['gluten', 'banana', 'gluten', 3, 'tree nut'] });
    expect(result.diet).toBe('');
    expect(result.intolerances).toEqual(['gluten', 'tree nut']);
  });

  it('behält gültige Werte', () => {
    expect(sanitizeDietPrefs({ diet: 'vegan', intolerances: ['soy'] })).toMatchObject({ diet: 'vegan', intolerances: ['soy'] });
  });

  it('trimmt Abneigungen, entfernt Duplikate ohne Groß-/Kleinschreibung und Leereinträge', () => {
    const result = sanitizeDietPrefs({ dislikes: ['  Pilze ', 'pilze', '', '   ', 'Koriander', 7] });
    expect(result.dislikes).toEqual(['Pilze', 'Koriander']);
  });

  it('kürzt Abneigungen auf die Maximallänge und die Anzahl auf das Maximum', () => {
    const long = 'a'.repeat(MAX_DISLIKE_LENGTH + 20);
    expect(sanitizeDietPrefs({ dislikes: [long] }).dislikes[0]).toHaveLength(MAX_DISLIKE_LENGTH);
    expect(sanitizeDietPrefs({ dislikes: manyTerms(MAX_DISLIKES + 5) }).dislikes).toHaveLength(MAX_DISLIKES);
  });

  it('hält dislikesEn parallel zu dislikes und leert ungültige Einträge', () => {
    const result = sanitizeDietPrefs({
      dislikes: ['Pilze', 'Koriander', 'Lauch', 'Ei'],
      dislikesEn: ['mushrooms', 'cilantro; DROP', 'x'.repeat(41)],
    });
    expect(result.dislikesEn).toEqual(['mushrooms', '', '', '']);
  });

  it('verschiebt dislikesEn nicht, wenn ein Duplikat davor entfernt wird', () => {
    const result = sanitizeDietPrefs({ dislikes: ['Pilze', 'pilze', 'Lauch'], dislikesEn: ['mushrooms', 'mushrooms', 'leek'] });
    expect(result.dislikes).toEqual(['Pilze', 'Lauch']);
    expect(result.dislikesEn).toEqual(['mushrooms', 'leek']);
  });
});

describe('sanitizeEnglishTerm', () => {
  it.each([
    ['Mushrooms', 'mushrooms'],
    ['  bell pepper ', 'bell pepper'],
    ['sun-dried tomato', 'sun-dried tomato'],
  ])('akzeptiert %s', (input, expected) => {
    expect(sanitizeEnglishTerm(input)).toBe(expected);
  });

  it.each([
    [42], [null], [''], ['   '], ['a'.repeat(41)], ['egg1'], ['egg, milk'], ['<script>'], ['a\nb'], ['"quoted"'],
  ])('verwirft %s', (input) => {
    expect(sanitizeEnglishTerm(input)).toBe('');
  });
});

describe('sanitizeProfileDiet', () => {
  it('lässt alte Profile ohne die Felder unverändert gültig', () => {
    const result = sanitizeProfileDiet(BASE_PROFILE);
    expect(result).toEqual(BASE_PROFILE);
    expect('diet' in result).toBe(false);
  });

  it('bereinigt vorhandene Felder und verändert das Original nicht', () => {
    const dirty = { ...BASE_PROFILE, diet: 'x' as never, intolerances: ['gluten', 'foo'] as never, dislikes: [' Pilze '] };
    const result = sanitizeProfileDiet(dirty);
    expect(result.diet).toBeUndefined();
    expect(result.intolerances).toEqual(['gluten']);
    expect(result.dislikes).toEqual(['Pilze']);
    expect(dirty.dislikes).toEqual([' Pilze ']);
  });
});

describe('Bearbeitung', () => {
  it('addDislike ergänzt getrimmt, ohne Duplikat und mit leerem englischen Platzhalter', () => {
    const one = addDislike(EMPTY_DIET_PREFS, '  Pilze ');
    expect(one.dislikes).toEqual(['Pilze']);
    expect(one.dislikesEn).toEqual(['']);
    expect(addDislike(one, 'PILZE')).toBe(one);
    expect(addDislike(one, '   ')).toBe(one);
    expect(EMPTY_DIET_PREFS.dislikes).toEqual([]);
  });

  it('addDislike respektiert die Obergrenze', () => {
    const full = manyTerms(MAX_DISLIKES).reduce(addDislike, EMPTY_DIET_PREFS);
    expect(full.dislikes).toHaveLength(MAX_DISLIKES);
    expect(addDislike(full, 'Noch eine')).toBe(full);
  });

  it('removeDislike entfernt Begriff und Übersetzung gemeinsam', () => {
    const prefs = { ...EMPTY_DIET_PREFS, dislikes: ['Pilze', 'Lauch'], dislikesEn: ['mushrooms', 'leek'] };
    expect(removeDislike(prefs, 0)).toMatchObject({ dislikes: ['Lauch'], dislikesEn: ['leek'] });
    expect(removeDislike(prefs, 5)).toBe(prefs);
  });

  it('toggleIntolerance schaltet um', () => {
    const on = toggleIntolerance(EMPTY_DIET_PREFS, 'gluten');
    expect(on.intolerances).toEqual(['gluten']);
    expect(toggleIntolerance(on, 'gluten').intolerances).toEqual([]);
  });
});

describe('dietPrefsOf / hasDietPrefs', () => {
  it('liefert leere Werte ohne Profil und erkennt gesetzte Werte', () => {
    expect(dietPrefsOf(null)).toEqual(EMPTY_DIET_PREFS);
    expect(hasDietPrefs(EMPTY_DIET_PREFS)).toBe(false);
    expect(hasDietPrefs(dietPrefsOf({ ...BASE_PROFILE, diet: 'vegan' }))).toBe(true);
    expect(hasDietPrefs({ ...EMPTY_DIET_PREFS, dislikes: ['Pilze'], dislikesEn: [''] })).toBe(true);
  });
});
