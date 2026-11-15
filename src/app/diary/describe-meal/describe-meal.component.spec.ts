import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../core/ai/ai.service';
import { MealParseResult, ParsedMealItem } from '../../core/ai/meal-parse';
import { DiaryStore, NewDiaryEntry } from '../../core/state/diary.store';
import { NumPipe } from '../../shared/num.pipe';
import { DescribeMealComponent } from './describe-meal.component';

const item = (name: string, portionG = 100, over: Partial<ParsedMealItem> = {}): ParsedMealItem => ({
  name, amount: 1, unit: 'Stk', portionG, isKcalDoubtful: false,
  per100g: { kcal: 200, proteinG: 10, carbsG: 20, fatG: 6, basis: 'per100g' }, ...over,
});
const result = (...items: ParsedMealItem[]): MealParseResult => ({ items, droppedCount: 0 });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const parseMeal = vi.fn<(text: string) => Promise<MealParseResult>>();
const add = vi.fn<(e: NewDiaryEntry) => { id: string }>();
const remove = vi.fn<(id: string) => void>();
const toastCreate = vi.fn();
const state = { isLive: true };

function setup() {
  parseMeal.mockReset();
  add.mockReset().mockImplementation(() => ({ id: `id-${add.mock.calls.length}` }));
  remove.mockReset();
  toastCreate.mockReset().mockResolvedValue({ present: vi.fn() });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [NumPipe],
    declarations: [DescribeMealComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      { provide: AiService, useValue: { isLive: () => state.isLive, parseMeal } },
      { provide: DiaryStore, useValue: { add, remove } },
      { provide: ToastController, useValue: { create: toastCreate, getTop: vi.fn().mockResolvedValue(undefined) } },
    ],
  });
  const fixture = TestBed.createComponent(DescribeMealComponent);
  fixture.componentRef.setInput('date', '2026-11-14');
  fixture.componentRef.setInput('meal', 'lunch');
  fixture.detectChanges();
  return fixture.componentInstance;
}
const flush = (): Promise<void> => new Promise((r) => setTimeout(r));

describe('DescribeMealComponent', () => {
  beforeEach(() => { state.isLive = true; });

  it('sperrt Erkennen bei leerem und zu langem Text', () => {
    const c = setup();
    expect(c.canRun()).toBe(false);
    c.setText('a'.repeat(501));
    expect(c.canRun()).toBe(false);
    c.setText('ein Apfel');
    expect(c.canRun()).toBe(true);
  });

  it('sperrt Erkennen ohne KI-Verbindung', () => {
    state.isLive = false;
    const c = setup();
    c.setText('ein Apfel');
    expect(c.canRun()).toBe(false);
  });

  it('zeigt nach dem Erkennen die Liste mit dem geschätzten Gewicht', async () => {
    const c = setup();
    parseMeal.mockResolvedValue(result(item('Apfel', 150)));
    c.setText('  ein Apfel ');
    await c.recognize();
    expect(parseMeal).toHaveBeenCalledWith('ein Apfel');
    expect(c.phase()).toBe('results');
    expect(c.rows()[0].amountG).toBe(150);
    expect(c.totals()).toEqual({ kcal: 300, proteinG: 15 });
  });

  it('löst bei Doppeltipp nur einen Aufruf aus', async () => {
    const c = setup();
    const d = deferred<MealParseResult>();
    parseMeal.mockReturnValue(d.promise);
    c.setText('Apfel');
    void c.recognize();
    void c.recognize();
    expect(parseMeal).toHaveBeenCalledTimes(1);
    d.resolve(result(item('Apfel')));
    await flush();
    expect(c.phase()).toBe('results');
  });

  it('verwirft die Antwort nach Abbrechen', async () => {
    const c = setup();
    const d = deferred<MealParseResult>();
    parseMeal.mockReturnValue(d.promise);
    c.setText('Apfel');
    void c.recognize();
    c.cancel();
    expect(c.phase()).toBe('idle');
    d.resolve(result(item('Apfel')));
    await flush();
    expect(c.phase()).toBe('idle');
    expect(c.rows()).toEqual([]);
  });

  it('lässt nur die jüngste Anfrage gelten (Abbruch, dann neuer Aufruf)', async () => {
    const c = setup();
    const first = deferred<MealParseResult>();
    const second = deferred<MealParseResult>();
    parseMeal.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    c.setText('Apfel');
    void c.recognize();
    c.cancel();
    void c.recognize();
    second.resolve(result(item('Birne')));
    await flush();
    first.resolve(result(item('Apfel')));
    await flush();
    expect(c.rows().map((r) => r.name)).toEqual(['Birne']);
  });

  it('zeigt bei Fehler die Meldung und erlaubt einen neuen Versuch', async () => {
    const c = setup();
    parseMeal.mockRejectedValueOnce(new Error('Zu viele Anfragen. Warte kurz und versuche es erneut.'));
    c.setText('Apfel');
    await c.recognize();
    expect(c.phase()).toBe('error');
    expect(c.errorText()).toMatch(/Zu viele Anfragen/);
    expect(c.canRun()).toBe(true);
  });

  it('zeigt bei leerem Ergebnis den Leerzustand', async () => {
    const c = setup();
    parseMeal.mockResolvedValue({ items: [], droppedCount: 2 });
    c.setText('Zeug');
    await c.recognize();
    expect(c.phase()).toBe('empty');
  });

  it('entfernt Zeilen; ohne Zeilen bleibt der Leerzustand', async () => {
    const c = setup();
    parseMeal.mockResolvedValue(result(item('A'), item('B')));
    c.setText('x');
    await c.recognize();
    c.remove(c.rows()[0]);
    expect(c.rows().map((r) => r.name)).toEqual(['B']);
    c.remove(c.rows()[0]);
    expect(c.phase()).toBe('empty');
  });

  it('rechnet bei Mengenänderung live neu und sperrt Eintragen bei ungültiger Menge', async () => {
    const c = setup();
    parseMeal.mockResolvedValue(result(item('A', 100)));
    c.setText('x');
    await c.recognize();
    c.setAmount(c.rows()[0], '200');
    expect(c.totals()).toEqual({ kcal: 400, proteinG: 20 });
    c.setAmount(c.rows()[0], '');
    expect(c.canLog()).toBe(false);
    c.step(c.rows()[0], 1);
    expect(c.rows()[0].amountG).toBe(10);
  });

  it('schreibt erst bei Eintragen: ein Eintrag je Zeile, Rückgängig nimmt alle zurück', async () => {
    const c = setup();
    const logged = vi.fn();
    c.logged.subscribe(logged);
    parseMeal.mockResolvedValue(result(item('A', 100), item('B', 50)));
    c.setText('x');
    await c.recognize();
    expect(add).not.toHaveBeenCalled();
    c.log();
    c.log();
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls[0][0]).toMatchObject({ dateISO: '2026-11-14', meal: 'lunch', label: 'A', amountG: 100, isEstimate: true });
    expect(add.mock.calls[1][0].facts.kcal).toBe(100);
    expect(logged).toHaveBeenCalledTimes(1);
    await flush();
    const toast = toastCreate.mock.calls[0][0];
    expect(toast.message).toContain('300 kcal'.replace('300', '300'));
    toast.buttons[0].handler();
    expect(remove).toHaveBeenCalledWith('id-1');
    expect(remove).toHaveBeenCalledWith('id-2');
  });
});
