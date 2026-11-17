import { CUSTOM_ELEMENTS_SCHEMA, SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../core/ai/ai.service';
import { FastFoodRequest, FastFoodSuggestion } from '../../core/models';
import { ProfileStore } from '../../core/state/profile.store';
import { DiaryStore } from '../../core/state/diary.store';
import { MAX_FASTFOOD_ROUNDS } from '../fastfood-options';
import { FastfoodSheetComponent } from './fastfood-sheet.component';

const PROFILE = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate', goal: 'maintain', updatedAt: '2026-11-01T10:00:00.000Z' } as const;

const sug = (itemName: string, kcal = 400): FastFoodSuggestion => ({
  restaurant: 'KFC', itemName, rationale: 'ok', estPrice: 4,
  facts: { kcal, proteinG: 25, carbsG: 40, fatG: 10, basis: 'perPortion' },
});

/** Antwort, die der Test selbst abschließt (für Wettläufe). */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const diaryAdd = vi.fn().mockReturnValue({ id: 'e1' });
const toastCreate = vi.fn().mockResolvedValue({ present: vi.fn() });
const lock = { readOnly: false };
const suggestFastfood = vi.fn<(req: FastFoodRequest) => Promise<FastFoodSuggestion[]>>();

function setup() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [FastfoodSheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: AiService, useValue: { isLive: () => true, suggestFastfood } },
      { provide: DiaryStore, useValue: { add: diaryAdd, remove: vi.fn(), isReadOnly: () => lock.readOnly } },
      { provide: ToastController, useValue: { create: toastCreate, getTop: vi.fn().mockResolvedValue(undefined) } },
    ],
  });
  const fixture = TestBed.createComponent(FastfoodSheetComponent);
  fixture.componentRef.setInput('date', '2026-11-14');
  fixture.detectChanges();
  return fixture.componentInstance;
}

const open = (c: FastfoodSheetComponent): void => c.ngOnChanges({ isOpen: new SimpleChange(false, true, false) });
const flush = (): Promise<void> => new Promise((r) => setTimeout(r));

describe('FastfoodSheetComponent', () => {
  beforeEach(() => { suggestFastfood.mockReset(); diaryAdd.mockClear(); toastCreate.mockClear(); lock.readOnly = false; });

  it('sendet Kriterien, Land, Kurztext und leere Ausschlussliste', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValue([sug('Wrap')]);
    c.ff.update((f) => ({ ...f, preferences: ['viel Protein', 'günstig'] }));
    await c.runFastfood();
    const req = suggestFastfood.mock.calls[0][0];
    expect(req.preferences).toEqual(['viel Protein', 'günstig']);
    expect(req.preference).toBe('viel Protein, günstig');
    expect(req.country).toBe('Österreich');
    expect(req.exclude).toEqual([]);
  });

  it('filtert doppelte Namen schon in der ersten Antwort', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValue([sug('Wrap'), sug('wrap')]);
    await c.runFastfood();
    expect(c.ffResults().map((s) => s.itemName)).toEqual(['Wrap']);
  });

  it('hängt weitere Vorschläge an, schließt gezeigte aus und lässt Duplikate weg', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValueOnce([sug('Wrap'), sug('Burger')]).mockResolvedValueOnce([sug('burger'), sug('Salat')]);
    await c.runFastfood();
    await c.moreFastfood();
    expect(suggestFastfood.mock.calls[1][0].exclude).toEqual(['Wrap', 'Burger']);
    expect(c.ffResults().map((s) => s.itemName)).toEqual(['Wrap', 'Burger', 'Salat']);
    expect(c.moreLoading()).toBe(false);
  });

  it('bietet höchstens MAX_FASTFOOD_ROUNDS Runden an, danach nur einen Hinweis', async () => {
    const c = setup();
    let n = 0;
    suggestFastfood.mockImplementation(async () => [sug(`Gericht ${n++}`)]);
    await c.runFastfood();
    for (let i = 0; i < MAX_FASTFOOD_ROUNDS; i++) {
      expect(c.canLoadMore()).toBe(true);
      await c.moreFastfood();
    }
    expect(c.canLoadMore()).toBe(false);
    expect(c.roundsExhausted()).toBe(true);
    await c.moreFastfood();
    expect(suggestFastfood).toHaveBeenCalledTimes(1 + MAX_FASTFOOD_ROUNDS);
  });

  it('meldet, wenn keine neuen Vorschläge kamen, und behält die Liste', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValueOnce([sug('Wrap')]).mockResolvedValueOnce([sug('WRAP')]);
    await c.runFastfood();
    await c.moreFastfood();
    expect(c.ffResults()).toHaveLength(1);
    expect(c.moreNote()).toMatch(/Keine weiteren/);
  });

  it('zeigt einen Fehler bei "Weitere Vorschläge" als Text und behält die Liste', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValueOnce([sug('Wrap')]).mockRejectedValueOnce(new Error('Zeitüberschreitung'));
    await c.runFastfood();
    await c.moreFastfood();
    expect(c.moreError()).toBe('Zeitüberschreitung');
    expect(c.ffResults()).toHaveLength(1);
    expect(c.moreLoading()).toBe(false);
  });

  it('ignoriert eine verspätete Antwort einer älteren Anfrage', async () => {
    const c = setup();
    const first = deferred<FastFoodSuggestion[]>();
    const second = deferred<FastFoodSuggestion[]>();
    suggestFastfood.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const p1 = c.runFastfood();
    const p2 = c.runFastfood();
    second.resolve([sug('Neu')]);
    await p2;
    first.resolve([sug('Alt')]);
    await p1;
    expect(c.ffResults().map((s) => s.itemName)).toEqual(['Neu']);
    expect(c.ffLoading()).toBe(false);
  });

  it('lässt ffLoading true, solange die neueste Anfrage läuft, auch wenn eine ältere endet', async () => {
    const c = setup();
    const first = deferred<FastFoodSuggestion[]>();
    const second = deferred<FastFoodSuggestion[]>();
    suggestFastfood.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const p1 = c.runFastfood();
    const p2 = c.runFastfood();
    first.resolve([sug('Alt')]);
    await p1;
    expect(c.ffLoading()).toBe(true);
    second.resolve([sug('Neu')]);
    await p2;
    expect(c.ffLoading()).toBe(false);
  });

  it('ignoriert eine Antwort, die nach dem Schließen oder erneutem Öffnen eintrifft', async () => {
    const c = setup();
    const late = deferred<FastFoodSuggestion[]>();
    suggestFastfood.mockReturnValueOnce(late.promise);
    open(c);
    const p = c.runFastfood();
    c.closeFastfood();
    open(c);
    late.resolve([sug('Spät')]);
    await p;
    expect(c.ffResults()).toEqual([]);
    expect(c.ffSearched()).toBe(false);
    expect(c.ffLoading()).toBe(false);
  });

  it('behält die Liste bei geänderten Angaben, verwirft aber laufende Anfragen', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValueOnce([sug('Wrap')]);
    await c.runFastfood();
    const late = deferred<FastFoodSuggestion[]>();
    suggestFastfood.mockReturnValueOnce(late.promise);
    const p = c.moreFastfood();
    c.onFormChange({ ...c.ff(), preferences: ['günstig'] });
    late.resolve([sug('Spät')]);
    await p;
    await flush();
    expect(c.ffResults().map((s) => s.itemName)).toEqual(['Wrap']);
    expect(c.moreLoading()).toBe(false);
  });

  it('liest das Land aus dem Profil und übernimmt es beim Öffnen', () => {
    const c = setup();
    TestBed.inject(ProfileStore).setProfile({ ...PROFILE, fastfoodCountry: 'Italien' });
    open(c);
    expect(c.ff().country).toBe('Italien');
    expect(c.country()).toBe('Italien');
  });

  it('schreibt das Land nicht mehr in die App-Einstellungen', () => {
    const c = setup();
    c.onFormChange({ ...c.ff(), country: 'Italien' });
    expect(JSON.parse(localStorage.getItem('nutritrack:app-settings') ?? '{}').fastfoodCountry).toBeUndefined();
  });

  describe('Schaltflächen', () => {
    it('zeigt vor der ersten Runde nur "Vorschläge holen"', () => {
      const c = setup();
      expect(c.showRun()).toBe(true);
      expect(c.showMore()).toBe(false);
    });

    it('zeigt nach einer Runde nur "Weitere Vorschläge"', async () => {
      const c = setup();
      suggestFastfood.mockResolvedValue([sug('Wrap')]);
      await c.runFastfood();
      expect(c.showRun()).toBe(false);
      expect(c.showMore()).toBe(true);
    });

    it('zeigt nach einer Änderung der Angaben wieder nur "Vorschläge holen"', async () => {
      const c = setup();
      suggestFastfood.mockResolvedValue([sug('Wrap')]);
      await c.runFastfood();
      c.onFormChange({ ...c.ff(), restaurant: 'Subway' });
      expect(c.showRun()).toBe(true);
      expect(c.showMore()).toBe(false);
    });

    it('geht zurück zu "Weitere Vorschläge", wenn die Änderung rückgängig gemacht wird', async () => {
      const c = setup();
      suggestFastfood.mockResolvedValue([sug('Wrap')]);
      await c.runFastfood();
      const before = c.ff();
      c.onFormChange({ ...before, restaurant: 'Subway' });
      c.onFormChange(before);
      expect(c.showMore()).toBe(true);
      expect(c.showRun()).toBe(false);
    });

    it('hält den Schnappschuss unveränderlich: spätere Änderungen am Formular berühren ihn nicht', async () => {
      const c = setup();
      suggestFastfood.mockResolvedValue([sug('Wrap')]);
      await c.runFastfood();
      const snapshot = c.lastInputs();
      c.onFormChange({ ...c.ff(), preferences: ['günstig'] });
      expect(c.lastInputs()).toBe(snapshot);
      expect(snapshot?.preferences).toEqual(['viel Protein']);
    });

    it('holt nach einer Änderung neu und zeigt danach wieder "Weitere Vorschläge"', async () => {
      const c = setup();
      suggestFastfood.mockResolvedValueOnce([sug('Wrap')]).mockResolvedValueOnce([sug('Burger')]);
      await c.runFastfood();
      c.onFormChange({ ...c.ff(), restaurant: 'Subway' });
      await c.runFastfood();
      expect(suggestFastfood.mock.calls[1][0].exclude).toEqual([]);
      expect(c.showMore()).toBe(true);
      expect(c.showRun()).toBe(false);
    });

    it('bietet bei leerem Ergebnis nur "Vorschläge holen" an', async () => {
      const c = setup();
      suggestFastfood.mockResolvedValue([]);
      await c.runFastfood();
      expect(c.showRun()).toBe(true);
      expect(c.showMore()).toBe(false);
    });

    it('zeigt nach der letzten Runde keine der beiden, solange nichts geändert ist', async () => {
      const c = setup();
      let n = 0;
      suggestFastfood.mockImplementation(async () => [sug('Gericht ' + n++)]);
      await c.runFastfood();
      for (let i = 0; i < MAX_FASTFOOD_ROUNDS; i++) await c.moreFastfood();
      expect(c.showMore()).toBe(false);
      expect(c.showRun()).toBe(false);
    });
  });

  it('kennzeichnet Vorschläge über dem Budget', () => {
    const c = setup();
    c.ff.update((f) => ({ ...f, kcalBudget: 500 }));
    expect(c.overBudget(sug('A', 700))).toBe(true);
    expect(c.overBudget(sug('A', 450))).toBe(false);
  });
});

describe('FastfoodSheetComponent: Budget ohne Tagesziel (T5)', () => {
  beforeEach(() => suggestFastfood.mockReset());

  it('sendet den angezeigten Wert (1500 kcal), wenn kein Tagesziel existiert', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValue([sug('Wrap')]);
    open(c);
    await c.runFastfood();
    expect(suggestFastfood.mock.calls[0][0].kcalBudget).toBe(1500);
  });

  it('markiert ohne Tagesziel nicht fast alles als über Budget', () => {
    const c = setup();
    expect(c.overBudget(sug('Burger', 1200))).toBe(false);
  });
});

describe('FastfoodSheetComponent: Eintragen (T8, F4)', () => {
  beforeEach(() => { diaryAdd.mockClear(); toastCreate.mockClear(); lock.readOnly = false; });

  it('trägt bei Doppeltipp nur einmal ein (T8)', () => {
    const c = setup();
    c.logFastfood(sug('Wrap'));
    c.logFastfood(sug('Wrap'));
    expect(diaryAdd).toHaveBeenCalledTimes(1);
  });

  it('trägt bei Schreibsperre nichts ein und zeigt die Sperrmeldung (F4)', async () => {
    const c = setup();
    lock.readOnly = true;
    c.logFastfood(sug('Wrap'));
    await flush();
    expect(diaryAdd).not.toHaveBeenCalled();
    expect(toastCreate.mock.calls[0][0].message).toContain('Nicht gespeichert');
  });
});
