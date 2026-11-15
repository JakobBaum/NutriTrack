import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SpoonacularProvider } from './spoonacular.provider';
import { environment } from '../../../../environments/environment';
import { ConsentStore } from '../../consent/consent.store';

const WORKER = 'https://nutritrack.example.workers.dev';

let http: HttpTestingController;
let provider: SpoonacularProvider;

beforeEach(() => {
  localStorage.clear();
  environment.aiProxyUrl = WORKER;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  provider = TestBed.inject(SpoonacularProvider);
  TestBed.inject(ConsentStore).grant(new Date(), true);
});
afterEach(() => http.verify());

describe('SpoonacularProvider.getRecipe', () => {
  it('lädt ein Rezept per Id über die Worker-Route und bildet es auf die App-Form ab', async () => {
    const promise = provider.getRecipe('4242');
    const req = http.expectOne((r) => r.url === `${WORKER}/recipes/4242/information`);
    expect(req.request.params.get('includeNutrition')).toBe('true');
    req.flush({
      id: 4242, title: 'Lentil Soup', servings: 2,
      extendedIngredients: [{ id: 1, name: 'lentils', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' } } }],
      analyzedInstructions: [{ steps: [{ number: 1, step: 'Simmer.' }] }],
    }, { headers: { 'X-Api-Quota-Left': '7' } });

    const recipe = await promise;

    expect(recipe).toMatchObject({ id: '4242', title: 'Lentil Soup', servings: 2, steps: ['Simmer.'] });
    expect(recipe.ingredients[0].name).toBe('lentils');
    expect(provider.quotaLeft()).toBe(7);
  });

  it('meldet 404 als nicht mehr vorhanden', async () => {
    const promise = provider.getRecipe('4242');
    http.expectOne(() => true).flush({ error: 'weg' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('lehnt ungültige Ids ab, ohne eine Anfrage zu senden', async () => {
    await expect(provider.getRecipe('../x')).rejects.toMatchObject({ reason: 'not-found' });
    http.expectNone(() => true);
  });

  it('meldet einen Netzfehler offline, wenn das Gerät offline ist', async () => {
    const promise = provider.getRecipe('4242');
    http.expectOne(() => true).error(new ProgressEvent('error'), { status: 0 });
    await expect(promise).rejects.toMatchObject({ reason: expect.stringMatching(/offline|unreachable/) });
  });
});
