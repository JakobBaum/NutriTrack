import { describe, expect, it, vi } from 'vitest';
import { Recipe } from '../core/models';
import { OnlineRecipeDetailsService } from '../core/recipes/online/online-recipe-details.service';
import { StoredRecipe } from '../core/recipes/online/online-recipe-ref';
import { OnlineSearchError } from '../core/recipes/online/spoonacular.errors';
import { ONLINE_LOAD_FAILED_MESSAGE, OnlineDetailLoader, describeLoadError } from './online-detail-loader';

const base: Recipe = {
  id: 'r1', title: 'Suppe', servings: 1, ingredients: [], steps: [], origin: 'online',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
const ref: StoredRecipe = { ...base, onlineRef: { source: 'spoonacular', externalId: '1', savedAt: base.createdAt } };
const full: Recipe = { ...base, ingredients: [{ name: 'Linsen', amount: 1, unit: 'g' }] };

const loaderWith = (resolve: ReturnType<typeof vi.fn>): OnlineDetailLoader =>
  new OnlineDetailLoader({ resolve } as unknown as OnlineRecipeDetailsService);

describe('OnlineDetailLoader', () => {
  it('gibt eigene Rezepte sofort zurück, ohne Ladezustand', async () => {
    const resolve = vi.fn();
    const loader = loaderWith(resolve);
    expect(await loader.load(base)).toBe(base);
    expect(resolve).not.toHaveBeenCalled();
    expect(loader.state().kind).toBe('idle');
  });

  it('zeigt Laden und liefert danach das volle Rezept', async () => {
    let finish!: (r: Recipe) => void;
    const loader = loaderWith(vi.fn().mockReturnValue(new Promise<Recipe>((r) => { finish = r; })));

    const pending = loader.load(ref);
    expect(loader.state().kind).toBe('loading');
    finish(full);

    expect(await pending).toBe(full);
    expect(loader.state().kind).toBe('idle');
  });

  it('hält Fehler mit Grund und Meldung fest und liefert null', async () => {
    const loader = loaderWith(vi.fn().mockRejectedValue(new OnlineSearchError('not-found', 'weg')));

    expect(await loader.load(ref)).toBeNull();
    expect(loader.state()).toEqual({ kind: 'error', reason: 'not-found', message: 'weg' });
  });

  it('verwirft die Antwort nach cancel()', async () => {
    let finish!: (r: Recipe) => void;
    const loader = loaderWith(vi.fn().mockReturnValue(new Promise<Recipe>((r) => { finish = r; })));

    const pending = loader.load(ref);
    loader.cancel();
    finish(full);

    expect(await pending).toBeNull();
    expect(loader.state().kind).toBe('idle');
  });

  it('verwirft die ältere Antwort bei einem neuen Aufruf', async () => {
    const finishers: ((r: Recipe) => void)[] = [];
    const loader = loaderWith(vi.fn().mockImplementation(() => new Promise<Recipe>((r) => finishers.push(r))));

    const first = loader.load(ref);
    const second = loader.load(ref);
    finishers[1](full);
    finishers[0]({ ...full, title: 'alt' });

    expect(await second).toBe(full);
    expect(await first).toBeNull();
  });
});

describe('describeLoadError', () => {
  it('nutzt die Meldung von Anbieter-Fehlern und eine Sammelmeldung sonst', () => {
    expect(describeLoadError(new OnlineSearchError('offline', 'x'))).toEqual({ reason: 'offline', message: 'x' });
    expect(describeLoadError(new Error('boom'))).toEqual({ reason: 'unknown', message: ONLINE_LOAD_FAILED_MESSAGE });
  });
});
