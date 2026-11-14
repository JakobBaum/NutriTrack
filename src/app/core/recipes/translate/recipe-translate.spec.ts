import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../ai/ai.service';
import { OnlineRecipe } from '../online/online-recipe.model';
import { RecipeTranslateService, applyTranslation, recipeTexts } from './recipe-translate';
import { ConsentStore } from '../../consent/consent.store';
import { TranslationCache } from './translation-cache';

const BASE: OnlineRecipe = {
  id: '1', title: 'Lentil Soup', servings: 2,
  ingredients: [{ name: 'red lentils', amount: 200, unit: 'g' }, { name: 'chopped fresh rosemary', amount: 1, unit: 'Stk' }],
  steps: ['Chop.', 'Cook.'],
};

const GERMAN = { title: 'Linsensuppe', ingredients: ['Rote Linsen', 'Rosmarin, frisch'], steps: ['Schneiden.', 'Kochen.'] };

function setup(live: boolean, translateRecipe = vi.fn().mockResolvedValue(GERMAN), consented = true) {
  localStorage.clear();
  TestBed.resetTestingModule();
  const ai = {
    isLive: () => live,
    translateRecipe,
    translateSearchQuery: vi.fn().mockResolvedValue('chicken'),
  };
  TestBed.configureTestingModule({ providers: [{ provide: AiService, useValue: ai }] });
  if (consented) TestBed.inject(ConsentStore).grant(new Date(), true);
  return { service: TestBed.inject(RecipeTranslateService), ai, translateRecipe, cache: TestBed.inject(TranslationCache) };
}

describe('applyTranslation', () => {
  it('takes texts but keeps amounts, units and servings', () => {
    const out = applyTranslation(BASE, GERMAN, true);
    expect(out.title).toBe('Linsensuppe');
    expect(out.servings).toBe(2);
    expect(out.ingredients).toEqual([{ name: 'Rote Linsen', amount: 200, unit: 'g' }, { name: 'Rosmarin, frisch', amount: 1, unit: 'Stk' }]);
    expect(out.lang).toBe('de');
  });

  it('keeps original texts when counts differ and marks lang en when incomplete', () => {
    const out = applyTranslation(BASE, { title: '', ingredients: ['Linsen'], steps: [] }, false);
    expect(out.title).toBe('Lentil Soup');
    expect(out.ingredients).toEqual(BASE.ingredients);
    expect(out.steps).toEqual(BASE.steps);
    expect(out.lang).toBe('en');
  });
});

describe('RecipeTranslateService', () => {
  beforeEach(() => localStorage.clear());

  it('translates through the AI and caches the complete result (never twice)', async () => {
    const { service, translateRecipe } = setup(true);
    const first = await service.translate(BASE);
    const second = await service.translate(BASE);
    expect(first.lang).toBe('de');
    expect(first.title).toBe('Linsensuppe');
    expect(second.title).toBe('Linsensuppe');
    expect(translateRecipe).toHaveBeenCalledTimes(1);
  });

  it('dedupes parallel requests for the same recipe', async () => {
    const { service, translateRecipe } = setup(true);
    await Promise.all([service.translate(BASE), service.translate(BASE)]);
    expect(translateRecipe).toHaveBeenCalledTimes(1);
  });

  it('retranslates when the source text changes', async () => {
    const { service, translateRecipe } = setup(true);
    await service.translate(BASE);
    await service.translate({ ...BASE, steps: ['Chop more.', 'Cook.'] });
    expect(translateRecipe).toHaveBeenCalledTimes(2);
  });

  it('skips recipes that are already German', async () => {
    const { service, translateRecipe } = setup(true);
    const out = await service.translate({ ...BASE, lang: 'de' });
    expect(out.lang).toBe('de');
    expect(translateRecipe).not.toHaveBeenCalled();
  });

  it('falls back honestly when the AI fails: dictionary ingredients, English text, lang en, no cache', async () => {
    const { service, cache } = setup(true, vi.fn().mockRejectedValue(new Error('offline')));
    const out = await service.translate(BASE);
    expect(out.lang).toBe('en');
    expect(out.title).toBe('Lentil Soup');
    expect(out.ingredients.map((i) => i.name)).toEqual(['Rote Linsen', 'Rosmarin, frisch']);
    expect(cache.get('anything')).toBeNull();
  });

  it('without AI marks the recipe as not translated and does not cache', async () => {
    const { service } = setup(false, vi.fn().mockResolvedValue({ ...recipeTexts(BASE), ingredients: ['Rote Linsen', 'Rosmarin, frisch'] }));
    const out = await service.translate(BASE);
    expect(out.lang).toBe('en');
    expect(out.ingredients[0].name).toBe('Rote Linsen');
  });

  it('reports progress while translating a list', async () => {
    const { service } = setup(true);
    const seen: string[] = [];
    await service.translateAll([BASE, { ...BASE, id: '2' }], (d, t) => seen.push(`${d}/${t}`));
    expect(seen).toEqual(['0/2', '1/2', '2/2']);
    expect(service.isTranslating()).toBe(false);
  });

  it('translates search queries via the AI and falls back to the original on errors', async () => {
    const { service, ai } = setup(true);
    expect((await service.translateQuery('Hähnchen')).query).toBe('chicken');
    ai.translateSearchQuery.mockRejectedValueOnce(new Error('x'));
    expect((await service.translateQuery('Hähnchen')).query).toBe('Hähnchen');
  });

  it('translates identical content only once, even under another recipe id', async () => {
    const { service, translateRecipe } = setup(true);
    await service.translate(BASE);
    const again = await service.translate({ ...BASE, id: '999' });
    expect(again.title).toBe('Linsensuppe');
    expect(translateRecipe).toHaveBeenCalledTimes(1);
  });

  it('translateAll runs several recipes in parallel (max 4), keeps the order and reports progress', async () => {
    let running = 0;
    let peak = 0;
    const translateRecipe = vi.fn(async (texts: { title: string }) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      return { ...GERMAN, title: 'DE ' + texts.title };
    });
    const { service } = setup(true, translateRecipe as never);
    const recipes = Array.from({ length: 9 }, (_, i) => ({ ...BASE, id: 'r' + i, title: 'Soup ' + i }));
    const progress: number[] = [];
    const out = await service.translateAll(recipes, (done) => progress.push(done));
    expect(out.map((r) => r.title)).toEqual(recipes.map((r) => 'DE ' + r.title));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(progress.at(0)).toBe(0);
    expect(progress.at(-1)).toBe(9);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });
});

describe('RecipeTranslateService ohne Zustimmung', () => {
  it('bietet keine KI-Übersetzung an und ruft die KI nie auf', async () => {
    const { service, translateRecipe, ai } = setup(true, undefined, false);

    expect(service.canTranslate()).toBe(false);
    const out = await service.translate(BASE);
    const query = await service.translateQuery('Hähnchen');

    expect(translateRecipe).not.toHaveBeenCalled();
    expect(ai.translateSearchQuery).not.toHaveBeenCalled();
    expect(out.lang).toBe('en');
    expect(query.viaAi).toBe(false);
  });
});
