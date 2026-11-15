import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaryStore } from '../../core/state/diary.store';
import { Recipe } from '../../core/models';
import { OnlineRecipeDetailsService } from '../../core/recipes/online/online-recipe-details.service';
import { ONLINE_SOURCE, StoredRecipe } from '../../core/recipes/online/online-recipe-ref';
import { AddEntrySheetComponent } from './add-entry-sheet.component';

const ref: StoredRecipe = {
  id: 'r1', title: 'Linsensuppe', servings: 1, ingredients: [], steps: [], origin: 'online',
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
  onlineRef: { source: ONLINE_SOURCE, externalId: '4242', savedAt: '2026-11-01T10:00:00.000Z' },
};
const full: Recipe = {
  ...ref, ingredients: [], factsPerServing: { kcal: 300, proteinG: 10, carbsG: 40, fatG: 5, basis: 'perPortion' },
};

describe('AddEntrySheetComponent: Rezept schnell eintragen', () => {
  let resolveDetails!: (r: Recipe) => void;
  let sheet: AddEntrySheetComponent;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [AddEntrySheetComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: OnlineRecipeDetailsService, useValue: { resolve: () => new Promise<Recipe>((res) => { resolveDetails = res; }) } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }), getTop: vi.fn().mockResolvedValue(undefined) } },
        { provide: ActionSheetController, useValue: { create: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(AddEntrySheetComponent);
    fixture.componentRef.setInput('date', '2026-11-14');
    sheet = fixture.componentInstance;
  });

  it('schreibt nach dem Schließen des Sheets keinen Eintrag mehr', async () => {
    const pending = sheet.quickAddRecipe(ref);
    sheet.closeAdd();
    resolveDetails(full);
    await pending;
    expect(TestBed.inject(DiaryStore).entries()).toEqual([]);
  });

  it('schreibt den Eintrag, wenn das Sheet offen bleibt', async () => {
    const pending = sheet.quickAddRecipe(ref);
    resolveDetails(full);
    await pending;
    expect(TestBed.inject(DiaryStore).entries()).toHaveLength(1);
  });
});
