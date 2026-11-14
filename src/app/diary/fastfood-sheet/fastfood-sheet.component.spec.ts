import { CUSTOM_ELEMENTS_SCHEMA, SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../core/ai/ai.service';
import { FastFoodRequest, FastFoodSuggestion } from '../../core/models';
import { AppSettingsStore } from '../../core/state/app-settings.store';
import { DiaryStore } from '../../core/state/diary.store';
import { MAX_FASTFOOD_ROUNDS } from '../fastfood-options';
import { FastfoodSheetComponent } from './fastfood-sheet.component';

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

const suggestFastfood = vi.fn<(req: FastFoodRequest) => Promise<FastFoodSuggestion[]>>();

function setup() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [FastfoodSheetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: AiService, useValue: { isLive: () => true, suggestFastfood } },
      { provide: DiaryStore, useValue: { add: vi.fn(), remove: vi.fn() } },
      { provide: ToastController, useValue: { create: vi.fn() } },
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
  beforeEach(() => suggestFastfood.mockReset());

  it('sendet Kriterien, Land, Kurztext und leere Ausschlussliste', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValue([sug('Wrap')]);
    c.ff = { ...c.ff, preferences: ['viel Protein', 'günstig'] };
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

  it('beginnt die Liste neu und verwirft laufende Anfragen, wenn das Formular geändert wird', async () => {
    const c = setup();
    suggestFastfood.mockResolvedValueOnce([sug('Wrap')]);
    await c.runFastfood();
    const late = deferred<FastFoodSuggestion[]>();
    suggestFastfood.mockReturnValueOnce(late.promise);
    const p = c.moreFastfood();
    c.onFormChange({ ...c.ff, preferences: ['günstig'] });
    late.resolve([sug('Spät')]);
    await p;
    await flush();
    expect(c.ffResults()).toEqual([]);
    expect(c.canLoadMore()).toBe(false);
    expect(c.moreLoading()).toBe(false);
  });

  it('speichert ein geändertes Land in den Einstellungen', () => {
    const c = setup();
    c.onFormChange({ ...c.ff, country: 'Italien' });
    expect(TestBed.inject(AppSettingsStore).fastfoodCountry()).toBe('Italien');
  });

  it('kennzeichnet Vorschläge über dem Budget', () => {
    const c = setup();
    c.ff = { ...c.ff, kcalBudget: 500 };
    expect(c.overBudget(sug('A', 700))).toBe(true);
    expect(c.overBudget(sug('A', 450))).toBe(false);
  });
});
