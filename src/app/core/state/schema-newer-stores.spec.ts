import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileStore } from './profile.store';
import { RecipeStore } from './recipe.store';
import { WeekPlanStore } from './week-plan.store';

const PREFIX = 'nutritrack:';
const newerProfile = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'neuer-wert', updatedAt: '2026-11-01T10:00:00.000Z' };
const legacyRecipe = {
  id: 'r1', title: 'Linsensuppe', servings: 2, origin: 'online', ingredients: [{ name: 'Linsen', amount: 200, unit: 'g' }], steps: ['Kochen'],
  sourceUrl: 'https://spoonacular.com/lentil-soup-4242', createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
};

function seedNewer(entries: Record<string, unknown>): void {
  localStorage.clear();
  localStorage.setItem(`${PREFIX}schemaVersion`, '99');
  Object.entries(entries).forEach(([k, v]) => localStorage.setItem(PREFIX + k, JSON.stringify(v)));
  TestBed.resetTestingModule();
}

const quarantineKeys = (): string[] => Object.keys(localStorage).filter((k) => k.includes('quarantine'));

describe('Stores bei neuerem Speicher-Schema (Review-Befund 1)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('Profil: verwirft unbekannte Werte nur im Arbeitsspeicher, löscht und sichert nichts', () => {
    seedNewer({ profile: newerProfile });
    expect(TestBed.inject(ProfileStore).profile()).toBeNull();
    expect(JSON.parse(localStorage.getItem(`${PREFIX}profile`) ?? 'null')).toEqual(newerProfile);
    expect(quarantineKeys()).toEqual([]);
  });

  it('Profil: übernimmt kein altes Fastfood-Land in den Speicher', () => {
    const valid = { ...newerProfile, goal: 'maintain' };
    seedNewer({ profile: valid, 'app-settings': { fastfoodCountry: 'Italien' } });
    expect(TestBed.inject(ProfileStore).profile()?.fastfoodCountry).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(`${PREFIX}profile`) ?? 'null')).toEqual(valid);
  });

  it('Wochenplan: löscht einen unbekannten Plan nicht', () => {
    const plan = { id: 'w1', neu: true };
    seedNewer({ 'week-plan': plan });
    expect(TestBed.inject(WeekPlanStore).plan()).toBeNull();
    expect(JSON.parse(localStorage.getItem(`${PREFIX}week-plan`) ?? 'null')).toEqual(plan);
    expect(quarantineKeys()).toEqual([]);
  });

  it('Rezepte: reduziert Online-Rezepte nicht auf Verweise', () => {
    seedNewer({ recipes: [legacyRecipe] });
    expect(TestBed.inject(RecipeStore).recipes()[0].ingredients).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(`${PREFIX}recipes`) ?? '[]')).toEqual([legacyRecipe]);
  });
});
