import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaryEntry, Recipe } from '../../core/models';
import { DiaryStore } from '../../core/state/diary.store';
import { FavoriteStore } from '../../core/state/favorite.store';
import { WRITE_BLOCKED_MESSAGE } from '../../core/storage/storage-messages';
import { StoredRecipe } from '../../core/recipes/online/online-recipe-ref';
import { AddEntrySheetComponent } from './add-entry-sheet.component';
import { NO_RECIPE_FACTS_MESSAGE } from './add-entry-logic';

const OATS: DiaryEntry = {
  id: 'e1', dateISO: '2026-11-13', meal: 'breakfast', label: 'Haferflocken', amountG: 100, createdAt: '2026-11-13T08:00:00.000Z',
  facts: { kcal: 370, proteinG: 13, carbsG: 60, fatG: 7, basis: 'perPortion' },
  baseFacts: { kcal: 370, proteinG: 13, carbsG: 60, fatG: 7, basis: 'per100g' },
} as DiaryEntry;

const BARE_RECIPE: StoredRecipe = {
  id: 'r2', title: 'Ohne Werte', servings: 2, ingredients: [], steps: [], origin: 'own',
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
} as StoredRecipe;

const lock = signal(false);
const toastCreate = vi.fn();
const sheetRole = { value: 'destructive' };
const sheetCreate = vi.fn();
const resetSheetMock = (): void => {
  sheetRole.value = 'destructive';
  sheetCreate.mockReset().mockImplementation(() =>
    Promise.resolve({ present: vi.fn(), onDidDismiss: () => Promise.resolve({ role: sheetRole.value }) }));
  toastCreate.mockReset().mockResolvedValue({ present: vi.fn() });
};

function setup(): { sheet: AddEntrySheetComponent; diary: DiaryStore } {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [AddEntrySheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ToastController, useValue: { create: toastCreate, getTop: vi.fn().mockResolvedValue(undefined) } },
      {
        provide: ActionSheetController,
        useValue: { create: sheetCreate },
      },
    ],
  });
  const diary = TestBed.inject(DiaryStore);
  vi.spyOn(diary, 'isReadOnly').mockImplementation((() => lock()) as never);
  const fixture = TestBed.createComponent(AddEntrySheetComponent);
  fixture.componentRef.setInput('date', '2026-11-14');
  return { sheet: fixture.componentInstance, diary };
}

describe('AddEntrySheetComponent: Formular', () => {
  beforeEach(() => {
    lock.set(false);
    resetSheetMock();
  });

  it('rechnet von Hand geänderte Werte bei Mengenänderung mit (T1)', () => {
    const { sheet } = setup();
    sheet.editRecent(OATS);
    sheet.setField('kcal', '200');
    sheet.setAmount(200);
    expect(sheet.form.kcal).toBe(400);
  });

  it('fragt beim Zurück aus dem Formular nach, wenn etwas eingegeben wurde (T2)', async () => {
    const { sheet } = setup();
    sheet.editRecent(OATS);
    sheet.setField('kcal', '200');
    sheetRole.value = 'cancel';
    await sheet.backToSearch();
    expect(sheet.view()).toBe('form');
    sheetRole.value = 'destructive';
    await sheet.backToSearch();
    expect(sheet.view()).toBe('search');
  });

  it('geht ohne Eingabe ohne Rückfrage zurück (T2)', async () => {
    const { sheet } = setup();
    sheet.editRecent(OATS);
    await sheet.backToSearch();
    expect(sheet.view()).toBe('search');
  });

  it('übernimmt den Suchtext in das manuelle Formular (T17)', () => {
    const { sheet } = setup();
    sheet.openManualEntry('Reis mit Hähnchen');
    expect(sheet.form.label).toBe('Reis mit Hähnchen');
    expect(sheet.view()).toBe('form');
  });

  it('übernommener Suchtext allein ist keine Eingabe, eigene Änderungen danach schon (S7a)', async () => {
    const { sheet } = setup();
    sheet.openManualEntry('Reis mit Hähnchen');
    sheetRole.value = 'cancel';
    await sheet.backToSearch();
    expect(sheet.view()).toBe('search');
    expect(sheetCreate).not.toHaveBeenCalled();
    sheet.openManualEntry('Reis');
    sheet.setLabel('Reis mit Soße');
    await sheet.backToSearch();
    expect(sheet.view()).toBe('form');
    expect(sheetCreate).toHaveBeenCalledTimes(1);
  });

  it('behält eigene Werte, die bei leerer Menge getippt wurden, wenn die Menge nachgetragen wird (S7b)', () => {
    const { sheet } = setup();
    sheet.editRecent(OATS);
    sheet.setAmount(null);
    sheet.setField('kcal', '200');
    sheet.setAmount(200);
    expect(sheet.form.kcal).toBe(200);
    sheet.setAmount(400);
    expect(sheet.form.kcal).toBe(400);
  });

  it('behält neue Werte, nachdem kcal geleert und wieder gesetzt wurden (S7b)', () => {
    const { sheet } = setup();
    sheet.editRecent(OATS);
    sheet.setField('kcal', '');
    sheet.setAmount(200);
    expect(sheet.form.kcal).toBeNull();
    sheet.setField('kcal', '300');
    sheet.setAmount(400);
    expect(sheet.form.kcal).toBe(600);
  });

  it('nennt den Zielort im Titel (U14)', () => {
    const { sheet } = setup();
    sheet.setMeal('snack');
    expect(sheet.modalTitle()).toBe('In Snacks eintragen');
  });
});

describe('AddEntrySheetComponent: Schließen ohne Rückfrage nach Erfolg (S1)', () => {
  beforeEach(() => {
    lock.set(false);
    resetSheetMock();
  });

  it('fragt nach dem Speichern nicht mehr nach, auch wenn das Formular schmutzig war', async () => {
    const { sheet } = setup();
    sheet.editRecent(OATS);
    sheet.setField('kcal', '200');
    sheet.save();
    expect(await sheet.canDismissAdd()).toBe(true);
    expect(sheetCreate).not.toHaveBeenCalled();
  });

  it('fragt nach erfolgreichem Eintragen aus Essen beschreiben nicht nach', async () => {
    const { sheet } = setup();
    sheet.showView('describe');
    sheet.describeMeal = { isDirty: () => true } as never;
    sheet.closeAdd();
    expect(await sheet.canDismissAdd()).toBe(true);
    expect(sheetCreate).not.toHaveBeenCalled();
  });

  it('fragt bei X genau einmal nach', async () => {
    const { sheet } = setup();
    sheet.showView('describe');
    sheet.describeMeal = { isDirty: () => true } as never;
    const closed = vi.fn();
    sheet.closed.subscribe(closed);
    await sheet.requestCloseAdd();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(await sheet.canDismissAdd()).toBe(true);
    expect(sheetCreate).toHaveBeenCalledTimes(1);
  });

  it('fragt nach erneutem Öffnen wieder nach', async () => {
    const { sheet } = setup();
    sheet.closeAdd();
    sheet.ngOnChanges({ isOpen: new SimpleChange(false, true, false) });
    sheet.editRecent(OATS);
    sheet.setField('kcal', '200');
    sheetRole.value = 'cancel';
    expect(await sheet.canDismissAdd()).toBe(false);
  });
});

describe('AddEntrySheetComponent: Rezept ohne Werte und Schreibsperre', () => {
  beforeEach(() => {
    lock.set(false);
    toastCreate.mockReset().mockResolvedValue({ present: vi.fn() });
  });

  it('meldet beim Schnell-Eintragen eines Rezepts ohne Nährwerte, was fehlt (F7)', async () => {
    const { sheet, diary } = setup();
    await sheet.quickAddRecipe(BARE_RECIPE);
    await vi.waitFor(() => expect(toastCreate).toHaveBeenCalled());
    expect(toastCreate.mock.calls[0][0].message).toBe(NO_RECIPE_FACTS_MESSAGE);
    expect(diary.entries()).toEqual([]);
  });

  it('trägt bei Schreibsperre nichts ein und zeigt die Sperrmeldung (F4, Schnell-Eintrag)', async () => {
    const { sheet, diary } = setup();
    lock.set(true);
    sheet.quickAddRecent(OATS);
    await vi.waitFor(() => expect(toastCreate).toHaveBeenCalled());
    expect(toastCreate.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
    expect(diary.entries()).toEqual([]);
  });

  it('trägt bei Schreibsperre nichts ein (F4, Speichern)', async () => {
    const { sheet, diary } = setup();
    sheet.editRecent(OATS);
    lock.set(true);
    sheet.save();
    await vi.waitFor(() => expect(toastCreate).toHaveBeenCalled());
    expect(toastCreate.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
    expect(diary.entries()).toEqual([]);
  });

  it('macht das Entfernen eines Favoriten rückgängig (T20)', async () => {
    const { sheet } = setup();
    const favorites = TestBed.inject(FavoriteStore);
    favorites.toggle(OATS);
    const [fav] = favorites.favorites();
    sheet.removeFavorite(fav.id);
    expect(favorites.favorites()).toHaveLength(0);
    await vi.waitFor(() => expect(toastCreate).toHaveBeenCalled());
    const undo = toastCreate.mock.calls[0][0].buttons?.find((b: { role?: string; handler?: () => void }) => b.handler);
    undo?.handler?.();
    expect(favorites.favorites()).toHaveLength(1);
  });
});

export type { Recipe };
