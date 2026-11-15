import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/lazy';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../core/ai/ai.service';
import { CameraService } from '../core/scan/camera.service';
import { RecipesPage } from './recipes.page';

interface Imported { title: string; servings: number; ingredients: { name: string; amount: number; unit: string }[]; steps: string[] }

const imported = (title: string): Imported => ({ title, servings: 2, ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }], steps: ['Kochen'] });

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function setup(importRecipe: ReturnType<typeof vi.fn>): RecipesPage {
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
  return TestBed.createComponent(RecipesPage).componentInstance;
}

describe('RecipesPage Import nach await (Nr. 11)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('übernimmt das Ergebnis, solange das Import-Sheet offen ist', async () => {
    const page = setup(vi.fn().mockResolvedValue(imported('Reispfanne')));
    page.openImport();
    page.importText = 'Reis';

    await page.runImport();

    expect(page.isModalOpen()).toBe(true);
    expect(page.form.title).toBe('Reispfanne');
    expect(page.importBusy()).toBe(false);
  });

  it('verwirft das Ergebnis, wenn das Import-Sheet währenddessen geschlossen wurde', async () => {
    const pending = deferred<Imported>();
    const page = setup(vi.fn().mockReturnValue(pending.promise));
    page.openImport();
    page.importText = 'Reis';

    const run = page.runImport();
    page.closeImport();
    pending.resolve(imported('Reispfanne'));
    await run;

    expect(page.isModalOpen()).toBe(false);
    expect(page.form.title).toBe('');
    expect(page.importBusy()).toBe(false);
  });

  it('überschreibt kein inzwischen geöffnetes neues Rezept', async () => {
    const pending = deferred<Imported>();
    const page = setup(vi.fn().mockReturnValue(pending.promise));
    page.openImport();
    page.importText = 'Reis';

    const run = page.runImport();
    page.closeImport();
    page.openAdd();
    page.form.title = 'Mein eigenes Rezept';
    pending.resolve(imported('Reispfanne'));
    await run;

    expect(page.form.title).toBe('Mein eigenes Rezept');
    expect(page.editId()).toBeNull();
  });

  it('verwirft die ältere Antwort, wenn der Import erneut gestartet wurde', async () => {
    const first = deferred<Imported>();
    const second = deferred<Imported>();
    const importRecipe = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const page = setup(importRecipe);
    page.openImport();
    page.importText = 'Reis';

    const runA = page.runImport();
    const runB = page.runImport();
    second.resolve(imported('Neu'));
    await runB;
    first.resolve(imported('Alt'));
    await runA;

    expect(page.form.title).toBe('Neu');
  });
});
