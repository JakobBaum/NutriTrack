import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppResumeService } from '../core/app-resume/app-resume.service';
import { DiaryEntry } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { DiaryPage } from './diary.page';

const lock = signal(false);
const toastCreate = vi.fn();

function setup(): { page: DiaryPage; diary: DiaryStore; entry: DiaryEntry } {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [DiaryPage],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: AppResumeService, useValue: { resumeCount: signal(0) } },
      { provide: ToastController, useValue: { create: toastCreate, getTop: vi.fn().mockResolvedValue(undefined) } },
      { provide: AlertController, useValue: { create: vi.fn() } },
      { provide: ActionSheetController, useValue: { create: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(DiaryPage, { set: { template: '', styleUrls: [] } });
  const diary = TestBed.inject(DiaryStore);
  vi.spyOn(diary, 'isReadOnly').mockImplementation((() => lock()) as never);
  const entry = diary.add({
    dateISO: '2026-11-14', meal: 'lunch', label: 'Reis',
    facts: { kcal: 200, proteinG: 4, carbsG: 40, fatG: 1, basis: 'perPortion' },
  });
  return { page: TestBed.createComponent(DiaryPage).componentInstance, diary, entry };
}

describe('DiaryPage: Schreibsperre (F4)', () => {
  beforeEach(() => {
    lock.set(false);
    toastCreate.mockReset().mockResolvedValue({ present: vi.fn() });
  });

  async function expectBlocked(): Promise<void> {
    await vi.waitFor(() => expect(toastCreate).toHaveBeenCalled());
    expect(toastCreate.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
  }

  it('dupliziert nicht und zeigt die Sperrmeldung', async () => {
    const { page, diary, entry } = setup();
    lock.set(true);
    page.duplicate(entry);
    await expectBlocked();
    expect(diary.entries()).toHaveLength(1);
  });

  it('löscht nicht und zeigt die Sperrmeldung', async () => {
    const { page, diary, entry } = setup();
    lock.set(true);
    page.remove(entry);
    await expectBlocked();
    expect(diary.entries()).toHaveLength(1);
  });

  it('dupliziert mit den geänderten Werten aus dem Bearbeiten-Sheet (T11)', () => {
    const { page, diary, entry } = setup();
    page.duplicateEdited({ entry, patch: { label: 'Reis XL', meal: 'dinner' } });
    const copy = diary.entries().find((e) => e.id !== entry.id);
    expect(copy?.label).toBe('Reis XL');
    expect(copy?.meal).toBe('dinner');
    expect(diary.entries().find((e) => e.id === entry.id)?.label).toBe('Reis');
  });
});
