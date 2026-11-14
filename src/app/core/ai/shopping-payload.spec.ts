import { describe, expect, it } from 'vitest';
import { MAX_PAYLOAD_RECIPES, buildShoppingPayload } from './shopping-payload';
import type { Recipe } from '../models';
import type { ShoppingPlanRequest } from './ai-provider';

const recipe = (title: string): Recipe =>
  ({ id: title, title, servings: 2, ingredients: [{ name: 'Mehl', amount: 100, unit: 'g' }], steps: ['Backen'], createdAt: '' }) as unknown as Recipe;

const request = (recipes: Recipe[]): ShoppingPlanRequest => ({ persons: 2, days: 3, meals: ['dinner'], budget: 20, store: 'Lidl', recipes });

describe('buildShoppingPayload', () => {
  it('sendet von den Rezepten nur den Titel', () => {
    const payload = buildShoppingPayload(request([recipe('Pasta')]));
    expect(payload.recipes).toEqual([{ title: 'Pasta' }]);
  });

  it('übernimmt die übrigen Wünsche unverändert', () => {
    const payload = buildShoppingPayload(request([]));
    expect(payload).toMatchObject({ persons: 2, days: 3, meals: ['dinner'], budget: 20, store: 'Lidl' });
  });

  it('sendet höchstens so viele Titel wie der Worker liest', () => {
    const many = Array.from({ length: MAX_PAYLOAD_RECIPES + 5 }, (_, i) => recipe(`R${i}`));
    expect(buildShoppingPayload(request(many)).recipes).toHaveLength(MAX_PAYLOAD_RECIPES);
  });

  it('verändert die Anfrage nicht', () => {
    const req = request([recipe('Pasta')]);
    buildShoppingPayload(req);
    expect(req.recipes[0].steps).toEqual(['Backen']);
  });
});
