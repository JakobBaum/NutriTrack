import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/lazy';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../core/ai/ai.service';
import { NutritionFacts } from '../core/models';
import { CameraService } from '../core/scan/camera.service';
import { RecipeStore } from '../core/state/recipe.store';
import { IngredientForm } from './recipe-form';
import { RecipesPage } from './recipes.page';

const FACTS: NutritionFacts = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5, basis: 'per100g' };

function setup(importRecipe: ReturnType<typeof vi.fn> = vi.fn()): { page: RecipesPage; store: RecipeStore } {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [RecipesPage],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: AiService, useValue: { isLive: () => true, importRecipe } },
      { provide: CameraService, useValue: { isNativeCameraAvailable: () => false } },
      { provide: ActionSheetController, useValue: {} },
      { provide: AlertController, useValue: {} },
      { provide: ModalController, useValue: {} },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(RecipesPage, { set: { template: '' } });
  const page = TestBed.createComponent(RecipesPage).componentInstance;
  return { page, store: TestBed.inject(RecipeStore) };
}

function fillValidRecipe(page: RecipesPage, title = 'Reispfanne'): void {
  page.form.title = title;
  page.form.ingredients = [{ name: 'Reis', amount: 100, unit: 'g', facts: FACTS }];
}

function saveTwoRecipes(page: RecipesPage): void {
  for (const title of ['A', 'B']) {
    page.openAdd();
    fillValidRecipe(page, title);
    page.save();
  }
}

const dismiss = (role: string): CustomEvent<{ role?: string }> => ({ detail: { role } }) as CustomEvent<{ role?: string }>;

describe('RecipesPage Speichern (R2)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('legt bei einem Doppel-Tipp auf Speichern nur ein Rezept an', () => {
    const { page, store } = setup();
    page.openAdd();
    fillValidRecipe(page);

    page.save();
    page.save();

    expect(store.recipes().length).toBe(1);
    expect(page.saving()).toBe(true);
  });

  it('erlaubt nach erneutem Öffnen wieder das Speichern', () => {
    const { page, store } = setup();
    saveTwoRecipes(page);

    expect(store.recipes().length).toBe(2);
  });

  it('sperrt nicht, wenn die Prüfung fehlschlägt (Titel fehlt)', () => {
    const { page, store } = setup();
    page.openAdd();

    page.save();

    expect(page.saving()).toBe(false);
    expect(page.error()).toMatch(/Titel/);
    expect(store.recipes().length).toBe(0);
  });
});

describe('RecipesPage aufgeklappte Zutat (R5)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('klappt beim Öffnen eines neuen Rezepts zu', () => {
    const { page } = setup();
    page.openAdd();
    page.expandedIndex.set(2);

    page.openAdd();

    expect(page.expandedIndex()).toBeNull();
  });

  it('klappt beim Bearbeiten eines anderen Rezepts zu', () => {
    const { page, store } = setup();
    page.openAdd();
    fillValidRecipe(page);
    page.save();
    page.expandedIndex.set(0);

    page.openEdit(store.recipes()[0]);

    expect(page.expandedIndex()).toBeNull();
  });

  it('führt den Index beim Entfernen einer Zutat davor nach', () => {
    const { page } = setup();
    page.openAdd();
    page.form.ingredients = [
      { name: 'A', amount: 1, unit: 'g' },
      { name: 'B', amount: 1, unit: 'g' },
      { name: 'C', amount: 1, unit: 'g' },
    ];
    page.expandedIndex.set(2);

    page.removeIngredient(0);

    expect(page.expandedIndex()).toBe(1);
    expect(page.form.ingredients[1].name).toBe('C');
  });

  it('klappt zu, wenn die aufgeklappte Zutat entfernt wird', () => {
    const { page } = setup();
    page.openAdd();
    page.form.ingredients = [{ name: 'A', amount: 1, unit: 'g' }, { name: 'B', amount: 1, unit: 'g' }];
    page.expandedIndex.set(1);

    page.removeIngredient(1);

    expect(page.expandedIndex()).toBeNull();
  });
});

describe('RecipesPage Nährwert-Felder (F1/R11)', () => {
  it('macht aus einem geleerten kcal-Feld „keine Werte“ statt 0 kcal', () => {
    const { page } = setup();
    const ing: IngredientForm = { name: 'Reis', amount: 100, unit: 'g', facts: FACTS };

    page.setFact(ing, 'kcal', '');

    expect(ing.facts).toBeUndefined();
  });

  it('klemmt negative Eingaben auf 0', () => {
    const { page } = setup();
    const ing: IngredientForm = { name: 'Reis', amount: 100, unit: 'g', facts: FACTS };

    page.setFact(ing, 'kcal', '-40');

    expect(ing.facts?.kcal).toBe(0);
  });
});

describe('RecipesPage Löschen mit Rückgängig (R10)', () => {
  it('stellt beim Rückgängig auch das zuerst gelöschte Rezept wieder her', () => {
    const { page, store } = setup();
    saveTwoRecipes(page);
    const [a, b] = store.recipes();

    page.remove(a.id);
    page.remove(b.id);
    expect(page.recipes().length).toBe(0);
    expect(store.recipes().length).toBe(2);

    page.onUndoDismiss(dismiss('undo'));

    expect(page.recipes().length).toBe(2);
    expect(store.recipes().length).toBe(2);
  });

  it('löscht beide endgültig, wenn der Hinweis ohne Rückgängig endet', () => {
    const { page, store } = setup();
    saveTwoRecipes(page);
    const [a, b] = store.recipes();

    page.remove(a.id);
    page.remove(b.id);
    page.onUndoDismiss(dismiss('timeout'));

    expect(store.recipes().length).toBe(0);
  });
});

describe('RecipesPage Link-Import mit Text-Rückfall (F5)', () => {
  const result = {
    title: 'Pasta',
    servings: 2,
    ingredients: [{ name: 'Nudeln', amount: 200, unit: 'g' }],
    steps: ['Kochen'],
    sourceUrl: 'https://a.test/r',
  };

  it('speichert bei Rückfall keine Quelle und weist den Nutzer darauf hin', async () => {
    const { page, store } = setup(vi.fn().mockResolvedValue({ ...result, usedFallbackText: true }));
    page.openImport();
    page.importText = 'Nudeln kochen';
    page.importUrl = 'https://a.test/r';

    await page.runImport();
    page.save();

    expect(store.recipes()[0].sourceUrl).toBeUndefined();
    expect(page.toastMessage()).toMatch(/Rezept gespeichert/);
  });

  it('zeigt den Hinweis zum Rückfall direkt nach dem Import', async () => {
    const { page } = setup(vi.fn().mockResolvedValue({ ...result, usedFallbackText: true }));
    page.openImport();
    page.importText = 'Nudeln kochen';
    page.importUrl = 'https://a.test/r';

    await page.runImport();

    expect(page.toastMessage()).toMatch(/Link war nicht abrufbar/);
  });

  it('speichert ohne Rückfall die Quelle wie bisher', async () => {
    const { page, store } = setup(vi.fn().mockResolvedValue(result));
    page.openImport();
    page.importUrl = 'https://a.test/r';

    await page.runImport();
    page.save();

    expect(store.recipes()[0].sourceUrl).toBe('https://a.test/r');
  });
});
