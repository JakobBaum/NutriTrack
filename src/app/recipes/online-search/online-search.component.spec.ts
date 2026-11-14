import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/lazy';
import { OnlineRecipe } from '../../core/recipes/online/online-recipe.model';
import { RecipeSearchAccessService } from '../../core/recipes/online/recipe-search-access';
import { SpoonacularProvider } from '../../core/recipes/online/spoonacular.provider';
import { RecipeTranslateService } from '../../core/recipes/translate/recipe-translate';
import { ProfileStore } from '../../core/state/profile.store';
import { OnlineSearchComponent } from './online-search.component';

const recipe = (id: string, title: string, ingredient = 'Salz'): OnlineRecipe => ({
  id, title, servings: 2, steps: ['x'], ingredients: [{ name: ingredient, amount: 1, unit: 'g' }],
});

function setup(search: ReturnType<typeof vi.fn>, withProfile = true, canTranslate: () => boolean = () => false): OnlineSearchComponent {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [OnlineSearchComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: SpoonacularProvider, useValue: { search, quotaLeft: () => null } },
      { provide: RecipeSearchAccessService, useValue: { isAvailable: () => true } },
      { provide: RecipeTranslateService, useValue: { canTranslate, translateQuery: async (q: string) => ({ query: q, viaAi: false }) } },
      { provide: ModalController, useValue: { dismiss: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(OnlineSearchComponent, { set: { template: '' } });
  if (withProfile) {
    TestBed.inject(ProfileStore).setProfile({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '',
      diet: 'vegan', intolerances: ['soy'], dislikes: ['Pilze', 'Ei'], dislikesEn: ['mushrooms', 'egg'],
    });
  }
  return TestBed.createComponent(OnlineSearchComponent).componentInstance;
}

describe('OnlineSearchComponent Profilfilter', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('belegt die Ernährungsform vor und zeigt den Profil-Filter als aktiv', () => {
    const component = setup(vi.fn());
    expect(component.diet()).toBe('vegan');
    expect(component.hasProfileFilter()).toBe(true);
    expect(component.profileFilterOn()).toBe(true);
  });

  it('zeigt den Hinweis nicht, wenn das Profil keine Ernährungsangaben hat', () => {
    expect(setup(vi.fn(), false).hasProfileFilter()).toBe(false);
  });

  it('schickt Ernährungsform, Unverträglichkeiten und Ausschlüsse mit der Suche', async () => {
    const search = vi.fn().mockResolvedValue({ recipes: [], totalResults: 0, quotaLeft: null });
    const component = setup(search);

    await component.search();

    expect(search.mock.calls[0][0]).toMatchObject({ diet: 'vegan', intolerances: ['soy'], excludeIngredients: ['mushrooms', 'egg'] });
  });

  it('sucht mit abgeschaltetem Profil-Filter ohne Profilangaben', async () => {
    const search = vi.fn().mockResolvedValue({ recipes: [], totalResults: 0, quotaLeft: null });
    const component = setup(search);

    await component.toggleProfileFilter();
    await component.search();

    const filters = search.mock.calls[0][0];
    expect(component.profileFilterOn()).toBe(false);
    expect(filters.diet).toBe('');
    expect(filters.intolerances ?? []).toEqual([]);
    expect(filters.excludeIngredients ?? []).toEqual([]);
  });

  it('stellt die Ernährungsform beim Wiedereinschalten wieder her', async () => {
    const component = setup(vi.fn());
    await component.toggleProfileFilter();
    await component.toggleProfileFilter();
    expect(component.diet()).toBe('vegan');
  });

  it('entfernt Treffer mit Abneigungen, solange der Profil-Filter aktiv ist', async () => {
    const page = { recipes: [recipe('1', 'Linsensuppe'), recipe('2', 'Pilzpfanne', 'Pilze'), recipe('3', 'Reis-Bowl')], totalResults: 3, quotaLeft: null };
    const component = setup(vi.fn().mockResolvedValue(page));

    await component.search();
    expect(component.results().map((r) => r.id)).toEqual(['1', '3']);

    await component.toggleProfileFilter();
    await component.search();
    expect(component.results().map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('lädt weitere Treffer ab der Zahl der abgerufenen (nicht der angezeigten) Rezepte nach', async () => {
    const first = { recipes: [recipe('1', 'A'), recipe('2', 'Pilzpfanne', 'Pilze'), recipe('3', 'C')], totalResults: 6, quotaLeft: null };
    const search = vi.fn().mockResolvedValueOnce(first).mockResolvedValue({ recipes: [recipe('4', 'D')], totalResults: 6, quotaLeft: null });
    const component = setup(search);

    await component.search();
    await component.loadMore();

    expect(search.mock.calls[1][1]).toBe(3);
    expect(component.results().map((r) => r.id)).toEqual(['1', '3', '4']);
  });
});

describe('OnlineSearchComponent Unverträglichkeiten und Nachladen', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('filtert Unverträglichkeiten auch in der App (alter Server verwirft den Parameter)', async () => {
    const page = { recipes: [recipe('1', 'Linsensuppe'), recipe('2', 'Sojapfanne', 'tofu'), recipe('3', 'Curry', 'coconut milk')], totalResults: 3, quotaLeft: null };
    const component = setup(vi.fn().mockResolvedValue(page));

    await component.search();

    expect(component.results().map((r) => r.id)).toEqual(['1', '3']);
  });

  it('zeigt einen eigenen Hinweis, wenn das Profil alle bisherigen Treffer ausblendet und es mehr gibt', async () => {
    const page = { recipes: [recipe('1', 'Pilzpfanne', 'Pilze')], totalResults: 5, quotaLeft: null };
    const component = setup(vi.fn().mockResolvedValue(page));

    await component.search();

    expect(component.results()).toEqual([]);
    expect(component.allHiddenByProfile()).toBe(true);
    expect(component.hasMore()).toBe(true);
  });

  it('zeigt den Hinweis nicht, wenn nichts gefunden wurde oder Treffer sichtbar sind', async () => {
    const empty = setup(vi.fn().mockResolvedValue({ recipes: [], totalResults: 0, quotaLeft: null }));
    await empty.search();
    expect(empty.allHiddenByProfile()).toBe(false);

    const shown = setup(vi.fn().mockResolvedValue({ recipes: [recipe('1', 'A')], totalResults: 5, quotaLeft: null }));
    await shown.search();
    expect(shown.allHiddenByProfile()).toBe(false);
  });

  it('beendet das Nachladen, wenn der Anbieter eine leere Seite liefert', async () => {
    const first = { recipes: [recipe('1', 'A')], totalResults: 50, quotaLeft: null };
    const search = vi.fn().mockResolvedValueOnce(first).mockResolvedValue({ recipes: [], totalResults: 50, quotaLeft: null });
    const component = setup(search);

    await component.search();
    expect(component.hasMore()).toBe(true);
    await component.loadMore();

    expect(component.hasMore()).toBe(false);
  });

  it('startet die Suche beim Umschalten des Profil-Filters neu, wenn schon gesucht wurde', async () => {
    const search = vi.fn().mockResolvedValue({ recipes: [], totalResults: 0, quotaLeft: null });
    const component = setup(search);
    await component.search();

    await component.toggleProfileFilter();

    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1][0].diet).toBe('');
  });

  it('startet beim Umschalten ohne vorherige Suche keine Suche', async () => {
    const search = vi.fn().mockResolvedValue({ recipes: [], totalResults: 0, quotaLeft: null });
    const component = setup(search);

    await component.toggleProfileFilter();

    expect(search).not.toHaveBeenCalled();
  });
});

describe('OnlineSearchComponent canTranslate', () => {
  it('folgt der Zustimmung, auch wenn sie nach dem Öffnen erteilt wird', () => {
    const consent = signal(false);
    const component = setup(vi.fn(), true, () => consent());
    expect(component.canTranslate()).toBe(false);
    consent.set(true);
    expect(component.canTranslate()).toBe(true);
  });
});
