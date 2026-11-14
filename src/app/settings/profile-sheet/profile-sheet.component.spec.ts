import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AiService } from '../../core/ai/ai.service';
import { ConsentStore } from '../../core/consent/consent.store';
import { ProfileStore } from '../../core/state/profile.store';
import { ProfileSheetComponent } from './profile-sheet.component';

const BASE = { weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '' } as const;

function setup(translate: ReturnType<typeof vi.fn>): { sheet: ProfileSheetComponent; store: ProfileStore } {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [ProfileSheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [provideHttpClient(), { provide: AiService, useValue: { translateSearchQuery: translate, isLive: () => true } }],
  });
  TestBed.overrideComponent(ProfileSheetComponent, { set: { template: '' } });
  TestBed.inject(ConsentStore).grant(new Date(), true);
  const store = TestBed.inject(ProfileStore);
  store.setProfile({ ...BASE });
  const fixture = TestBed.createComponent(ProfileSheetComponent);
  fixture.componentRef.setInput('isOpen', true);
  fixture.detectChanges();
  return { sheet: fixture.componentInstance, store };
}

describe('ProfileSheetComponent Ernährung', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('speichert Ernährungsform, Unverträglichkeiten und Abneigungen samt englischer Übersetzung', async () => {
    const { sheet, store } = setup(vi.fn(async () => 'Mushrooms'));
    const saved = vi.fn();
    const closed = vi.fn();
    sheet.saved.subscribe(saved);
    sheet.closed.subscribe(closed);

    sheet.setDiet('vegan');
    sheet.toggleIntolerance('gluten');
    sheet.dislikeInput.set('Pilze');
    sheet.addDislike();
    await sheet.save();

    expect(store.profile()).toMatchObject({ diet: 'vegan', intolerances: ['gluten'], dislikes: ['Pilze'], dislikesEn: ['mushrooms'] });
    expect(saved).toHaveBeenCalledWith(expect.not.stringContaining('nicht übersetzt'));
    expect(closed).toHaveBeenCalled();
  });

  it('speichert trotz fehlgeschlagener Übersetzung, lässt den englischen Begriff leer und sagt es', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sheet, store } = setup(vi.fn(async () => {
      throw new Error('offline');
    }));
    const saved = vi.fn();
    sheet.saved.subscribe(saved);

    sheet.dislikeInput.set('Pilze');
    sheet.addDislike();
    await sheet.save();

    expect(store.profile()).toMatchObject({ dislikes: ['Pilze'], dislikesEn: [''] });
    expect(saved).toHaveBeenCalledWith(expect.stringContaining('nicht übersetzt'));
    expect(sheet.saving()).toBe(false);
  });

  it('ruft für bereits übersetzte Abneigungen die KI nicht erneut auf', async () => {
    const translate = vi.fn(async () => 'leek');
    const { sheet, store } = setup(translate);
    store.setProfile({ ...BASE, dislikes: ['Pilze'], dislikesEn: ['mushrooms'] });
    sheet.isOpen();
    const fixtureSheet = sheet;
    fixtureSheet.form.update((f) => ({ ...f, dietPrefs: { ...f.dietPrefs, dislikes: ['Pilze'], dislikesEn: ['mushrooms'] } }));

    await sheet.save();

    expect(translate).not.toHaveBeenCalled();
  });

  it('erklärt bei den Unverträglichkeiten, dass nach Zutatennamen gefiltert wird', () => {
    const { sheet } = setup(vi.fn());

    expect(sheet.intoleranceHint).toContain('Zutatennamen');
    expect(sheet.intoleranceHint).toContain('Spuren');
    expect(sheet.dietHint).toContain('ersetzt nicht das Prüfen der Zutaten');
  });

  it('entfernt Abneigungen per Chip und begrenzt die Eingabe', () => {
    const { sheet } = setup(vi.fn());
    sheet.dislikeInput.set('Pilze');
    sheet.addDislike();
    sheet.dislikeInput.set('Lauch');
    sheet.addDislike();
    expect(sheet.dislikeInput()).toBe('');

    sheet.removeDislike(0);

    expect(sheet.form().dietPrefs.dislikes).toEqual(['Lauch']);
  });
});
