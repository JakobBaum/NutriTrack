import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProfileStore } from './profile.store';
import { DiaryStore } from './diary.store';
import { RecipeStore } from './recipe.store';
import { ShoppingStore } from './shopping.store';
import { NutritionFacts, UserProfile } from '../models';

const profile: UserProfile = {
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'lose',
  rateKgPerWeek: 0.5,
  updatedAt: '2026-10-13T00:00:00.000Z',
};

function facts(kcal: number, proteinG = 0): NutritionFacts {
  return { kcal, proteinG, carbsG: 0, fatG: 0, basis: 'perPortion' };
}

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
});

describe('ProfileStore', () => {
  it('startet ohne Profil und ohne Ziel', () => {
    const store = TestBed.inject(ProfileStore);
    expect(store.hasProfile()).toBe(false);
    expect(store.target()).toBeNull();
  });

  it('leitet nach setProfile ein Tagesziel ab und persistiert', () => {
    const store = TestBed.inject(ProfileStore);
    store.setProfile(profile);
    expect(store.hasProfile()).toBe(true);
    expect(store.target()?.kcal).toBeGreaterThan(1000);
    expect(store.target()?.proteinG).toBeGreaterThan(0);

    // Neue Instanz liest den persistierten Wert aus dem Storage.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(ProfileStore);
    expect(reloaded.hasProfile()).toBe(true);
  });

  it('löscht Profil und Ziel bei clear()', () => {
    const store = TestBed.inject(ProfileStore);
    store.setProfile(profile);
    store.clear();
    expect(store.hasProfile()).toBe(false);
    expect(store.target()).toBeNull();
  });
});

describe('DiaryStore', () => {
  it('fügt Einträge hinzu und summiert pro Tag', () => {
    const store = TestBed.inject(DiaryStore);
    store.add({ dateISO: '2026-10-13', meal: 'breakfast', label: 'Müsli', facts: facts(300, 10) });
    store.add({ dateISO: '2026-10-13', meal: 'lunch', label: 'Pasta', facts: facts(600, 20) });
    store.add({ dateISO: '2026-10-14', meal: 'lunch', label: 'Reis', facts: facts(500) });

    expect(store.entriesForDate('2026-10-13')).toHaveLength(2);
    expect(store.totalsForDate('2026-10-13').kcal).toBe(900);
    expect(store.totalsForDate('2026-10-13').proteinG).toBe(30);
    expect(store.kcalForMeal('2026-10-13', 'lunch')).toBe(600);
  });

  it('entfernt Einträge', () => {
    const store = TestBed.inject(DiaryStore);
    const e = store.add({ dateISO: '2026-10-13', meal: 'snack', label: 'Apfel', facts: facts(80) });
    store.remove(e.id);
    expect(store.entriesForDate('2026-10-13')).toHaveLength(0);
  });
});

describe('RecipeStore', () => {
  it('legt an, aktualisiert, findet und löscht Rezepte', () => {
    const store = TestBed.inject(RecipeStore);
    const r = store.add({ title: 'Pasta', servings: 2, ingredients: [], steps: [], origin: 'own' });
    expect(store.recipes()).toHaveLength(1);
    expect(store.get(r.id)?.title).toBe('Pasta');

    store.update(r.id, { title: 'Pasta al Tonno', servings: 3, ingredients: [], steps: [], origin: 'own' });
    expect(store.get(r.id)?.title).toBe('Pasta al Tonno');
    expect(store.get(r.id)?.servings).toBe(3);

    store.remove(r.id);
    expect(store.recipes()).toHaveLength(0);
  });
});

describe('ShoppingStore', () => {
  it('generiert eine Liste aus den vorhandenen Rezepten', () => {
    const recipes = TestBed.inject(RecipeStore);
    recipes.add({
      title: 'Pasta',
      servings: 2,
      ingredients: [{ name: 'Nudeln', amount: 200, unit: 'g' }],
      steps: [],
      origin: 'own',
    });
    const shopping = TestBed.inject(ShoppingStore);
    const list = shopping.generate(1, 4);
    expect(list.suggestedDishes).toEqual(['Pasta']);
    expect(list.items[0]).toMatchObject({ name: 'Nudeln', amount: 400 });
  });

  it('hakt Positionen ab und entfernt sie', () => {
    const shopping = TestBed.inject(ShoppingStore);
    shopping.generate(1, 1); // Basis-Liste
    const count = shopping.list()!.items.length;
    shopping.toggleItem(0);
    expect(shopping.list()!.items[0].checked).toBe(true);
    shopping.removeItem(0);
    expect(shopping.list()!.items).toHaveLength(count - 1);
  });

  it('fügt manuelle Positionen hinzu', () => {
    const shopping = TestBed.inject(ShoppingStore);
    shopping.addItem({ name: 'Milch', amount: 1, unit: 'L', checked: false });
    expect(shopping.list()!.items.at(-1)).toMatchObject({ name: 'Milch', unit: 'L' });
  });
});
