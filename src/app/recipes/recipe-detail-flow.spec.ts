import { describe, expect, it, vi } from 'vitest';
import { Recipe } from '../core/models';
import { OnlineRecipeDetailsService } from '../core/recipes/online/online-recipe-details.service';
import { StoredRecipe } from '../core/recipes/online/online-recipe-ref';
import { OnlineSearchError } from '../core/recipes/online/spoonacular.errors';
import { OnlineDetailLoader } from './online-detail-loader';
import { RecipeDetailFlow } from './recipe-detail-flow';

const base = { servings: 1, ingredients: [] as Recipe['ingredients'], steps: [] as string[], createdAt: 'a', updatedAt: 'a' };
const ref = (id: string): StoredRecipe => ({
  ...base, id, title: `Rezept ${id}`, origin: 'online',
  onlineRef: { source: 'spoonacular', externalId: id, savedAt: '2026-11-01T10:00:00.000Z' },
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(resolve: (r: StoredRecipe) => Promise<Recipe>) {
  const host = { toast: vi.fn(), remove: vi.fn(), edit: vi.fn(), diary: vi.fn().mockResolvedValue(undefined) };
  const flow = new RecipeDetailFlow(new OnlineDetailLoader({ resolve } as unknown as OnlineRecipeDetailsService), host);
  return { flow, host };
}

describe('RecipeDetailFlow.ensureFull (Nr. R4)', () => {
  it('öffnet das Detail nicht wieder, wenn der Nutzer es während des Ladens geschlossen hat', async () => {
    const pending = deferred<Recipe>();
    const { flow } = setup(() => pending.promise);
    const stored = ref('1');
    flow.recipe.set(stored);

    const run = flow.ensureFull(stored);
    flow.close();
    pending.resolve({ ...stored } as Recipe);

    expect(await run).toBeNull();
    expect(flow.recipe()).toBeNull();
  });

  it('überschreibt kein inzwischen geöffnetes anderes Detail durch eine veraltete Antwort', async () => {
    const first = deferred<Recipe>();
    const second = deferred<Recipe>();
    const answers = [first, second];
    const { flow } = setup(() => (answers.shift() as ReturnType<typeof deferred<Recipe>>).promise);
    const a = ref('1');
    const b = ref('2');

    const run = flow.ensureFull(a);
    const open = flow.open(b);
    first.resolve({ ...a } as Recipe);
    second.resolve({ ...b } as Recipe);
    await run;
    await open;

    expect(flow.recipe()?.id).toBe('2');
  });

  it('zeigt bei einem echten Ladefehler weiter das Detail mit Fehlerzustand', async () => {
    const { flow } = setup(async () => { throw new OnlineSearchError('offline', 'Kein Netz.'); });
    const stored = ref('1');

    expect(await flow.ensureFull(stored)).toBeNull();

    expect(flow.recipe()?.id).toBe('1');
    expect(flow.loader.state()).toMatchObject({ kind: 'error', message: 'Kein Netz.' });
  });
});
