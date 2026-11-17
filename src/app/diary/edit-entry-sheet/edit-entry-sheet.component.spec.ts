import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaryEntry } from '../../core/models';
import { DiaryStore } from '../../core/state/diary.store';
import { WRITE_BLOCKED_MESSAGE } from '../../core/storage/storage-messages';
import { EditEntrySheetComponent } from './edit-entry-sheet.component';
import { EMPTY_NAME_MESSAGE } from './edit-entry-logic';

const ENTRY: DiaryEntry = {
  id: 'e1', dateISO: '2026-11-14', meal: 'lunch', label: 'Reis', amountG: 200, unit: 'g', createdAt: '2026-11-14T10:00:00.000Z',
  ref: { kind: 'manual' },
  facts: { kcal: 200, proteinG: 20, carbsG: 40, fatG: 10, basis: 'perPortion' },
  baseFacts: { kcal: 100, proteinG: 10, carbsG: 20, fatG: 5, basis: 'per100g' },
} as DiaryEntry;

const lock = signal(false);
const toastCreate = vi.fn();
let pickedMealText = 'Abendessen';

function setup(): { sheet: EditEntrySheetComponent; diary: DiaryStore } {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [EditEntrySheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: ToastController, useValue: { create: toastCreate, getTop: vi.fn().mockResolvedValue(undefined) } },
      {
        provide: ActionSheetController,
        useValue: {
          create: vi.fn().mockImplementation((opts: { buttons: { text: string; handler?: () => void }[] }) =>
            Promise.resolve({
              present: vi.fn(),
              onDidDismiss: () => {
                opts.buttons.find((b) => b.text === pickedMealText)?.handler?.();
                return Promise.resolve({ role: undefined });
              },
            })),
        },
      },
    ],
  });
  const diary = TestBed.inject(DiaryStore);
  vi.spyOn(diary, 'isReadOnly').mockImplementation((() => lock()) as never);
  diary.add({ dateISO: ENTRY.dateISO, meal: ENTRY.meal, label: ENTRY.label, amountG: 200, facts: ENTRY.facts, baseFacts: ENTRY.baseFacts, ref: ENTRY.ref });
  const fixture = TestBed.createComponent(EditEntrySheetComponent);
  fixture.componentRef.setInput('entry', diary.entries()[0]);
  fixture.detectChanges();
  return { sheet: fixture.componentInstance, diary };
}

describe('EditEntrySheetComponent', () => {
  beforeEach(() => {
    lock.set(false);
    pickedMealText = 'Abendessen';
    toastCreate.mockReset().mockResolvedValue({ present: vi.fn() });
  });

  it('zeigt die gewählte Essenszeit sofort an (T4)', async () => {
    const { sheet } = setup();
    expect(sheet.mealName()).toBe('Mittagessen');
    await sheet.pickMeal();
    expect(sheet.mealName()).toBe('Abendessen');
  });

  it('zeigt Schritte und Chips mit Dezimalkomma (T6)', () => {
    const { sheet } = setup();
    sheet.setUnit('kg');
    sheet.stepAmount(1);
    expect(sheet.amountText()).toBe('0,25');
  });

  it('behält beim Tippen den Rohtext, z. B. "1," (T6)', () => {
    const { sheet } = setup();
    sheet.setAmount('1,');
    expect(sheet.amountText()).toBe('1,');
  });

  it('meldet einen leeren Namen und nimmt die Meldung bei der Korrektur zurück (T7, T10)', () => {
    const { sheet, diary } = setup();
    sheet.setLabel('  ');
    sheet.save();
    expect(sheet.error()).toBe(EMPTY_NAME_MESSAGE);
    sheet.setLabel('Reis');
    expect(sheet.error()).toBeNull();
    sheet.save();
    expect(diary.entries()[0].label).toBe('Reis');
  });

  it('speichert bei Schreibsperre nicht und zeigt die Sperrmeldung (F4)', async () => {
    const { sheet, diary } = setup();
    sheet.setAmount('300');
    lock.set(true);
    sheet.save();
    await vi.waitFor(() => expect(toastCreate).toHaveBeenCalled());
    expect(toastCreate.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
    expect(diary.entries()[0].amountG).toBe(200);
  });

  it('gibt beim Doppelt-Eintragen die geänderten Werte mit (T11)', () => {
    const { sheet } = setup();
    const emitted = vi.fn();
    sheet.duplicate.subscribe(emitted);
    sheet.setAmount('300');
    sheet.duplicateEntry();
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0].patch.amountG).toBe(300);
  });
});
