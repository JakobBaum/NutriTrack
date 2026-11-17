import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AiService } from '../../core/ai/ai.service';
import { ConsentStore } from '../../core/consent/consent.store';
import { ProfileStore } from '../../core/state/profile.store';
import { AlertController } from '@ionic/angular';
import { WRITE_BLOCKED_MESSAGE } from '../../core/storage/storage-messages';
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

describe('ProfileSheetComponent Verwerfen, Tempo, Abneigungen', () => {
  const askAlert = vi.fn();

  function setupSheet(): { sheet: ProfileSheetComponent; store: ProfileStore } {
    askAlert.mockReset().mockResolvedValue({ present: async () => undefined, onDidDismiss: async () => ({ role: 'destructive' }) });
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [ProfileSheetComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: AiService, useValue: { translateSearchQuery: vi.fn(async () => 'x'), isLive: () => true } },
        { provide: AlertController, useValue: { create: askAlert } },
      ],
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

  it('blockiert das Schließen, solange das Speichern läuft (S5)', async () => {
    const { sheet } = setupSheet();
    sheet.saving.set(true);
    expect(await sheet.canDismiss()).toBe(false);
    expect(askAlert).not.toHaveBeenCalled();
    sheet.saving.set(false);
    expect(await sheet.canDismiss()).toBe(true);
  });

  it('fragt bei unveränderten Eingaben nicht nach und lässt das Schließen zu', async () => {
    const { sheet } = setupSheet();
    expect(sheet.isDirty()).toBe(false);
    expect(await sheet.canDismiss()).toBe(true);
    expect(askAlert).not.toHaveBeenCalled();
  });

  it('fragt bei geänderten Eingaben "Verwerfen?" und bleibt offen, wenn der Nutzer weiter bearbeitet', async () => {
    const { sheet } = setupSheet();
    askAlert.mockResolvedValue({ present: async () => undefined, onDidDismiss: async () => ({ role: 'cancel' }) });
    sheet.setField('weightKg', 72);
    const closed = vi.fn();
    sheet.closed.subscribe(closed);

    await sheet.requestClose();

    expect(askAlert).toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('schließt nach bestätigtem Verwerfen', async () => {
    const { sheet } = setupSheet();
    sheet.setField('weightKg', 72);
    const closed = vi.fn();
    sheet.closed.subscribe(closed);

    await sheet.requestClose();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('fragt nach dem Speichern nicht mehr nach', async () => {
    const { sheet } = setupSheet();
    sheet.setField('weightKg', 72);
    await sheet.save();
    askAlert.mockClear();

    expect(await sheet.canDismiss()).toBe(true);
    expect(askAlert).not.toHaveBeenCalled();
  });

  it('nimmt beim Wechsel von Halten zu Zunehmen das Tempo 0,25', () => {
    const { sheet } = setupSheet();
    sheet.setGoal('gain');
    expect(sheet.form().rateKgPerWeek).toBe(0.25);
  });

  it('zeigt vor der Gewichtseingabe keinen kcal-Wert zum Tempo', () => {
    const { sheet } = setupSheet();
    sheet.form.update((f) => ({ ...f, goal: 'lose', weightKg: null }));
    expect(sheet.rateDeltaText()).toBe('');
  });

  it('lässt das Feld bei einem doppelten Eintrag stehen und leert es nur bei Erfolg', () => {
    const { sheet } = setupSheet();
    sheet.dislikeInput.set('Pilze');
    sheet.addDislike();
    expect(sheet.dislikeInput()).toBe('');

    sheet.dislikeInput.set('pilze');
    sheet.addDislike();

    expect(sheet.form().dietPrefs.dislikes).toEqual(['Pilze']);
    expect(sheet.dislikeInput()).toBe('pilze');
  });
});

describe('ProfileSheetComponent Schreibsperre', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('meldet keinen Erfolg und bleibt offen, wenn das Profil nicht gespeichert werden konnte', async () => {
    const { sheet } = setup(vi.fn(async () => 'x'));
    const saved = vi.fn();
    const closed = vi.fn();
    sheet.saved.subscribe(saved);
    sheet.closed.subscribe(closed);
    window.dispatchEvent(new StorageEvent('storage', { key: 'nutritrack:diary', newValue: '[]', storageArea: localStorage }));

    sheet.setField('weightKg', 72);
    await sheet.save();

    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(sheet.saveError()).toBe(WRITE_BLOCKED_MESSAGE);
  });
});
