import { describe, expect, it, vi } from 'vitest';
import { NutritionFacts, Recipe } from '../core/models';
import { OnlineRecipeDetailsService } from '../core/recipes/online/online-recipe-details.service';
import { StoredRecipe } from '../core/recipes/online/online-recipe-ref';
import { OnlineSearchError } from '../core/recipes/online/spoonacular.errors';
import { IMPLAUSIBLE_FACTS_MESSAGE, NO_FACTS_MESSAGE, RecipeFactsLoader, isPlausibleServingFacts } from './recipe-facts-loader';

const facts = (over: Partial<NutritionFacts> = {}): NutritionFacts => ({ kcal: 300, proteinG: 18, carbsG: 40, fatG: 5, basis: 'perPortion', ...over });
const base = { servings: 1, ingredients: [] as Recipe['ingredients'], steps: [] as string[], createdAt: 'a', updatedAt: 'a' };
const ref: StoredRecipe = {
  ...base, id: 'r1', title: 'Linsensuppe', origin: 'online',
  onlineRef: { source: 'spoonacular', externalId: '42', savedAt: '2026-11-01T10:00:00.000Z' },
};
const full = (f?: NutritionFacts): Recipe => ({ ...ref, servings: 2, ingredients: [{ name: 'Linsen', amount: 1, unit: 'g' }], factsPerServing: f });

function loader(resolve: (r: StoredRecipe) => Promise<Recipe>): RecipeFactsLoader {
  return new RecipeFactsLoader({ resolve } as unknown as OnlineRecipeDetailsService);
}

describe('RecipeFactsLoader', () => {
  it('gibt eigene Rezepte sofort mit ihren Werten zurück, ohne zu laden', async () => {
    const resolve = vi.fn();
    const own: StoredRecipe = { ...base, id: 'o', title: 'Reis', origin: 'own', factsPerServing: facts() };

    const out = await loader(resolve).load(own);

    expect(out?.facts.kcal).toBe(300);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lädt einen Verweis nach: Ladezustand, dann Werte je Portion', async () => {
    let finish!: (r: Recipe) => void;
    const l = loader(() => new Promise<Recipe>((r) => (finish = r)));

    const pending = l.load(ref);
    expect(l.state()).toEqual({ kind: 'loading', title: 'Linsensuppe' });
    finish(full(facts()));
    const out = await pending;

    expect(out).toMatchObject({ facts: { kcal: 300, proteinG: 18 }, recipe: { id: 'r1' } });
    expect(l.state()).toEqual({ kind: 'idle' });
  });

  it('meldet einen Ladefehler mit Meldung und dem Rezept zum erneuten Versuch', async () => {
    const l = loader(async () => { throw new OnlineSearchError('offline', 'Kein Netz.'); });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await l.load(ref)).toBeNull();

    expect(l.state()).toEqual({ kind: 'error', message: 'Kein Netz.', recipe: ref });
  });

  it('meldet ein Rezept ohne Nährwerte', async () => {
    const l = loader(async () => full(undefined));

    expect(await l.load(ref)).toBeNull();

    expect(l.state()).toMatchObject({ kind: 'error', message: NO_FACTS_MESSAGE });
  });

  it('trägt unplausible Nährwerte nicht ein', async () => {
    const l = loader(async () => full(facts({ kcal: 90000 })));

    expect(await l.load(ref)).toBeNull();

    expect(l.state()).toMatchObject({ kind: 'error', message: IMPLAUSIBLE_FACTS_MESSAGE });
  });

  it('verwirft eine veraltete Antwort, wenn inzwischen ein anderes Rezept gewählt wurde', async () => {
    const resolvers: Array<(r: Recipe) => void> = [];
    const l = loader(() => new Promise<Recipe>((r) => resolvers.push(r)));

    const first = l.load(ref);
    const second = l.load({ ...ref, id: 'r2', title: 'Curry' });
    resolvers[0](full(facts({ kcal: 111 })));
    resolvers[1](full(facts({ kcal: 222 })));

    expect(await first).toBeNull();
    expect((await second)?.facts.kcal).toBe(222);
  });

  it('cancel verwirft laufende Antworten und setzt den Zustand zurück', async () => {
    let finish!: (r: Recipe) => void;
    const l = loader(() => new Promise<Recipe>((r) => (finish = r)));

    const pending = l.load(ref);
    l.cancel();
    finish(full(facts()));

    expect(await pending).toBeNull();
    expect(l.state()).toEqual({ kind: 'idle' });
  });
});

describe('isPlausibleServingFacts', () => {
  it('akzeptiert übliche Portionen', () => expect(isPlausibleServingFacts(facts())).toBe(true));
  it('lehnt negative, nicht endliche und übergroße Werte ab', () => {
    expect(isPlausibleServingFacts(facts({ kcal: -1 }))).toBe(false);
    expect(isPlausibleServingFacts(facts({ proteinG: Number.NaN }))).toBe(false);
    expect(isPlausibleServingFacts(facts({ kcal: 5000 }))).toBe(false);
    expect(isPlausibleServingFacts(facts({ fatG: 900 }))).toBe(false);
  });
});
