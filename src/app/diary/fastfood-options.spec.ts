import { describe, expect, it } from 'vitest';
import {
  FASTFOOD_CHAINS, OTHER_RESTAURANT, defaultKcalBudget, resolveRestaurant, restaurantChoice, snapToRange, MONEY_RANGE,
  MAX_PREFERENCES, MAX_FASTFOOD_ROUNDS, PREFERENCE_OPTIONS, EXCLUDE_MAX_ITEMS, EXCLUDE_ITEM_MAX_CHARS, PREFERENCE_TEXT_MAX_CHARS,
  isOverBudget, mergeSuggestions, excludeNames, preferenceSummary, sanitizePreferences, togglePreference,
} from './fastfood-options';

describe('fastfood-options', () => {
  it('clamps the default kcal budget into the slider range', () => {
    expect(defaultKcalBudget(0)).toBe(200);
    expect(defaultKcalBudget(5000)).toBe(1500);
    expect(defaultKcalBudget(823)).toBe(800);
  });

  it('falls back to the maximum when remaining kcal is not finite', () => {
    expect(defaultKcalBudget(Number.NaN)).toBe(1500);
  });

  it('snaps money to half euros inside 3..30', () => {
    expect(snapToRange(7.3, MONEY_RANGE)).toBe(7.5);
    expect(snapToRange(1, MONEY_RANGE)).toBe(3);
    expect(snapToRange(99, MONEY_RANGE)).toBe(30);
  });

  it('maps known chains to themselves and unknown to other', () => {
    expect(restaurantChoice(FASTFOOD_CHAINS[0])).toBe(FASTFOOD_CHAINS[0]);
    expect(restaurantChoice('Dönerladen')).toBe(OTHER_RESTAURANT);
  });

  it('resolves the restaurant name from choice or custom text', () => {
    expect(resolveRestaurant('KFC', 'x')).toBe('KFC');
    expect(resolveRestaurant(OTHER_RESTAURANT, '  Dönerladen ')).toBe('Dönerladen');
  });


  describe('Kriterien (Mehrfachauswahl)', () => {
    const [protein, kcal, sugar, veg, cheap] = PREFERENCE_OPTIONS.map((o) => o.value);

    it('waehlt ein Kriterium hinzu und ab', () => {
      expect(togglePreference([protein], kcal)).toEqual([protein, kcal]);
      expect(togglePreference([protein, kcal], protein)).toEqual([kcal]);
    });

    it('laesst nie weniger als ein Kriterium zu', () => {
      expect(togglePreference([protein], protein)).toEqual([protein]);
    });

    it('laesst hoechstens vier Kriterien zu', () => {
      const four = [protein, kcal, sugar, veg];
      expect(four).toHaveLength(MAX_PREFERENCES);
      expect(togglePreference(four, cheap)).toEqual(four);
      expect(togglePreference(four, veg)).toEqual([protein, kcal, sugar]);
    });

    it('veraendert das Eingabe-Array nicht', () => {
      const input = [protein];
      togglePreference(input, kcal);
      expect(input).toEqual([protein]);
    });

    it('bereinigt unbekannte, doppelte und zu viele Werte, Fallback auf das erste Kriterium', () => {
      expect(sanitizePreferences([kcal, kcal, 'unsinn', 7])).toEqual([kcal]);
      expect(sanitizePreferences('viel Protein')).toEqual([protein]);
      expect(sanitizePreferences(undefined)).toEqual([protein]);
      expect(sanitizePreferences(PREFERENCE_OPTIONS.map((o) => o.value))).toHaveLength(MAX_PREFERENCES);
    });

    it('fasst Kriterien kompakt zusammen, immer unter der Grenze des alten Workers (60)', () => {
      expect(preferenceSummary([protein, kcal])).toBe('viel Protein, wenig Kalorien');
      const longest = [...PREFERENCE_OPTIONS].sort((a, b) => b.value.length - a.value.length).slice(0, MAX_PREFERENCES).map((o) => o.value);
      expect(preferenceSummary(longest).length).toBeLessThanOrEqual(PREFERENCE_TEXT_MAX_CHARS);
      expect(PREFERENCE_TEXT_MAX_CHARS).toBeLessThan(60);
    });
  });

  describe('Weitere Vorschlaege', () => {
    const s = (itemName: string, kcalValue = 400) => ({
      restaurant: 'X', itemName, rationale: '', facts: { kcal: kcalValue, proteinG: 20, carbsG: 40, fatG: 10, basis: 'perPortion' as const },
    });

    it('haengt neue Vorschlaege an und filtert doppelte Namen ohne Gross-/Kleinschreibung', () => {
      const merged = mergeSuggestions([s('Wrap'), s('Burger')], [s('wrap '), s('Salat'), s('SALAT'), s('Burger')]);
      expect(merged.map((x) => x.itemName)).toEqual(['Wrap', 'Burger', 'Salat']);
    });

    it('liefert Namen zum Ausschliessen, begrenzt in Anzahl (neueste) und Laenge', () => {
      const many = Array.from({ length: EXCLUDE_MAX_ITEMS + 5 }, (_, i) => s(`Gericht ${i}`));
      const names = excludeNames(many);
      expect(names).toHaveLength(EXCLUDE_MAX_ITEMS);
      expect(names[names.length - 1]).toBe(`Gericht ${EXCLUDE_MAX_ITEMS + 4}`);
      expect(excludeNames([s('A'.repeat(200))])[0]).toHaveLength(EXCLUDE_ITEM_MAX_CHARS);
    });

    it('hat eine begrenzte Rundenzahl', () => {
      expect(MAX_FASTFOOD_ROUNDS).toBe(4);
    });

    it('kennzeichnet Vorschlaege ueber dem Budget mit kleiner Toleranz', () => {
      expect(isOverBudget(s('A', 500), 500)).toBe(false);
      expect(isOverBudget(s('A', 520), 500)).toBe(false);
      expect(isOverBudget(s('A', 600), 500)).toBe(true);
    });
  });
});
