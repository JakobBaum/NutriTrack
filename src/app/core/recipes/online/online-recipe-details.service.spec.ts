import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Recipe } from '../../models';
import { RecipeTranslateService } from '../translate/recipe-translate';
import { OnlineRecipe } from './online-recipe.model';
import { ONLINE_RECIPE_OFFLINE_MESSAGE, ONLINE_RECIPE_TTL_MS, OnlineRecipeDetailsService, RESOLVE_ALL_CONCURRENCY } from './online-recipe-details.service';
import { OnlineSearchError } from './spoonacular.errors';
import { SpoonacularProvider } from './spoonacular.provider';

const online = (id = '4242'): OnlineRecipe => ({
  id, title: 'Lentil Soup', servings: 2, sourceUrl: 'https://blog.example/soup',
  ingredients: [{ name: 'lentils', amount: 200, unit: 'g' }], steps: ['Simmer.'],
  facts: { kcal: 300, proteinG: 18, carbsG: 40, fatG: 5, basis: 'perPortion' },
});

const ref = (externalId = '4242'): Recipe & { onlineRef: { source: 'spoonacular'; externalId: string; savedAt: string } } => ({
  id: 'recipe_1', title: 'Linsensuppe', servings: 1, ingredients: [], steps: [], origin: 'online',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  onlineRef: { source: 'spoonacular', externalId, savedAt: '2026-01-01T00:00:00.000Z' },
});

function setup(getRecipe: ReturnType<typeof vi.fn>, translate: (r: OnlineRecipe) => Promise<OnlineRecipe> = async (r) => r): OnlineRecipeDetailsService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SpoonacularProvider, useValue: { getRecipe } },
      { provide: RecipeTranslateService, useValue: { translate } },
    ],
  });
  return TestBed.inject(OnlineRecipeDetailsService);
}

describe('OnlineRecipeDetailsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  it('gibt eigene Rezepte unverändert zurück und fragt nichts ab', async () => {
    const getRecipe = vi.fn();
    const service = setup(getRecipe);
    const own: Recipe = { ...ref(), onlineRef: undefined, origin: 'own', ingredients: [{ name: 'Reis', amount: 1, unit: 'g' }] } as Recipe;

    expect(await service.resolve(own)).toBe(own);
    expect(getRecipe).not.toHaveBeenCalled();
  });

  it('lädt die Details eines Verweises nach und behält Id und Zeitstempel des gespeicherten Rezepts', async () => {
    const getRecipe = vi.fn().mockResolvedValue(online());
    const service = setup(getRecipe);

    const full = await service.resolve(ref());

    expect(getRecipe).toHaveBeenCalledWith('4242');
    expect(full).toMatchObject({ id: 'recipe_1', title: 'Lentil Soup', servings: 2, steps: ['Simmer.'], origin: 'online' });
    expect(full.ingredients.length).toBe(1);
    expect(full.factsPerServing?.kcal).toBe(300);
    expect(full.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('nutzt den Arbeitsspeicher-Zwischenspeicher innerhalb einer Stunde', async () => {
    const getRecipe = vi.fn().mockResolvedValue(online());
    const service = setup(getRecipe);
    await service.resolve(ref());

    vi.setSystemTime(Date.now() + ONLINE_RECIPE_TTL_MS - 1000);
    await service.resolve(ref());

    expect(getRecipe).toHaveBeenCalledTimes(1);
  });

  it('lädt nach Ablauf der einen Stunde neu', async () => {
    const getRecipe = vi.fn().mockResolvedValue(online());
    const service = setup(getRecipe);
    await service.resolve(ref());

    vi.setSystemTime(Date.now() + ONLINE_RECIPE_TTL_MS + 1000);
    await service.resolve(ref());

    expect(getRecipe).toHaveBeenCalledTimes(2);
    expect(service.peek('4242')).toBeDefined();
  });

  it('fasst parallele Anfragen für dieselbe Id zusammen', async () => {
    let finish!: (r: OnlineRecipe) => void;
    const getRecipe = vi.fn().mockReturnValue(new Promise<OnlineRecipe>((r) => { finish = r; }));
    const service = setup(getRecipe);

    const first = service.resolve(ref());
    const second = service.resolve(ref());
    finish(online());
    await Promise.all([first, second]);

    expect(getRecipe).toHaveBeenCalledTimes(1);
  });

  it('speichert Fehler nicht im Zwischenspeicher: erneuter Versuch fragt wieder ab', async () => {
    const getRecipe = vi.fn()
      .mockRejectedValueOnce(new OnlineSearchError('server', 'kaputt'))
      .mockResolvedValue(online());
    const service = setup(getRecipe);

    await expect(service.resolve(ref())).rejects.toMatchObject({ reason: 'server' });
    await expect(service.resolve(ref())).resolves.toBeDefined();
  });

  it('meldet offline mit eigenem Hinweis, ohne anzufragen, wenn nichts im Zwischenspeicher liegt', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const getRecipe = vi.fn();
    const service = setup(getRecipe);

    await expect(service.resolve(ref())).rejects.toMatchObject({ reason: 'offline', message: ONLINE_RECIPE_OFFLINE_MESSAGE });
    expect(getRecipe).not.toHaveBeenCalled();
  });

  it('zeigt auch einen Netzfehler des Anbieters als eigenen Offline-Hinweis', async () => {
    const getRecipe = vi.fn().mockRejectedValue(new OnlineSearchError('offline', 'allgemein'));
    const service = setup(getRecipe);

    await expect(service.resolve(ref())).rejects.toMatchObject({ reason: 'offline', message: ONLINE_RECIPE_OFFLINE_MESSAGE });
  });

  it('übersetzt die geladenen Texte, wenn möglich', async () => {
    const getRecipe = vi.fn().mockResolvedValue(online());
    const service = setup(getRecipe, async (r) => ({ ...r, title: 'Linsensuppe', lang: 'de' }));

    expect((await service.resolve(ref())).title).toBe('Linsensuppe');
  });
});

describe('OnlineRecipeDetailsService.resolveAll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  const own = (): Recipe => ({ ...ref(), onlineRef: undefined, origin: 'own' } as Recipe);

  it('löst Verweise auf, lässt eigene Rezepte unverändert und behält die Reihenfolge', async () => {
    const getRecipe = vi.fn(async (id: string) => online(id));
    const service = setup(getRecipe);
    const mine = own();

    const out = await service.resolveAll([ref('1'), mine, ref('2')]);

    expect(out.map((o) => o.ok)).toEqual([true, true, true]);
    expect(out[1]).toMatchObject({ ok: true, recipe: mine });
    expect(out[0].ok && out[0].recipe.ingredients.length).toBe(1);
    expect(getRecipe).toHaveBeenCalledTimes(2);
  });

  it('liefert Fehler je Rezept, ohne die übrigen zu verwerfen', async () => {
    const boom = new OnlineSearchError('server', 'kaputt');
    const getRecipe = vi.fn(async (id: string) => {
      if (id === '2') throw boom;
      return online(id);
    });
    const service = setup(getRecipe);

    const out = await service.resolveAll([ref('1'), ref('2'), ref('3')]);

    expect(out.map((o) => o.ok)).toEqual([true, false, true]);
    expect(out[1]).toMatchObject({ ok: false, error: boom });
    expect(out[1].source.onlineRef?.externalId).toBe('2');
  });

  it('lädt höchstens RESOLVE_ALL_CONCURRENCY Rezepte gleichzeitig', async () => {
    let running = 0;
    let peak = 0;
    const getRecipe = vi.fn(async (id: string) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return online(id);
    });
    const service = setup(getRecipe);
    const refs = Array.from({ length: RESOLVE_ALL_CONCURRENCY * 3 }, (_, i) => ref(String(i + 10)));

    const pending = service.resolveAll(refs);
    await vi.advanceTimersByTimeAsync(200);
    const out = await pending;

    expect(out.every((o) => o.ok)).toBe(true);
    expect(peak).toBe(RESOLVE_ALL_CONCURRENCY);
  });

  it('gibt bei leerer Liste eine leere Liste zurück', async () => {
    expect(await setup(vi.fn()).resolveAll([])).toEqual([]);
  });
});
