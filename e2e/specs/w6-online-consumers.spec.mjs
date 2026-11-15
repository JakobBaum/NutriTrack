// Welle 6: Verbraucher gespeicherter Online-Verweise (Tagebuch "Rezept", Einkaufsliste) laden Details nach.
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_TOUCH_PX = 44;
const RECIPE_ID = 4242;
const TITLE = 'Mock Lentil Soup';
const ISO = new Date().toISOString();
const KCAL = 320;
const PROTEIN_G = 18;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

const REF_RECIPE = {
  id: 'recipe_ref_1', title: TITLE, servings: 1, ingredients: [], steps: [], origin: 'online',
  createdAt: ISO, updatedAt: ISO,
  onlineRef: { source: 'spoonacular', externalId: String(RECIPE_ID), savedAt: ISO },
};

const DETAIL = {
  id: RECIPE_ID, title: TITLE, servings: 2, sourceName: 'Mock Blog', sourceUrl: 'https://blog.example/lentil-soup',
  nutrition: {
    nutrients: [
      { name: 'Calories', amount: KCAL, unit: 'kcal' }, { name: 'Protein', amount: PROTEIN_G, unit: 'g' },
      { name: 'Fat', amount: 6, unit: 'g' }, { name: 'Carbohydrates', amount: 48, unit: 'g' },
    ],
  },
  extendedIngredients: [
    { id: 1, name: 'lentils', nameClean: 'red lentils', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' } } },
  ],
  analyzedInstructions: [{ name: '', steps: [{ number: 1, step: 'Simmer the lentils.' }] }],
};

const json = (status, body) => ({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

/** Mock für Detail und KI-Einkaufsliste; `mode` steuert die Detail-Antwort ('ok' | 'error'), `shoppingPayloads` sammelt die KI-Anfragen. */
async function mockWorker(page) {
  const state = { mode: 'ok', detailHits: 0, shoppingPayloads: [] };
  await page.route('https://*.workers.dev/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes(`/recipes/${RECIPE_ID}/information`)) {
      state.detailHits += 1;
      return route.fulfill(state.mode === 'error' ? json(500, { error: 'x' }) : json(200, DETAIL));
    }
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    if (body.fn === 'generateShoppingList') {
      state.shoppingPayloads.push(body.payload);
      return route.fulfill(json(200, { items: [{ name: 'Rote Linsen', amount: 400, unit: 'g' }], suggestedDishes: [TITLE], estTotal: 0 }));
    }
    return route.fulfill(json(200, {}));
  });
  return state;
}

/** Öffnet das Eintragen-Sheet und wählt die Rezeptliste. */
async function openRecipeList(page) {
  await go(page, 'diary');
  await page.locator('[data-testid="diary-add"]').click();
  const modal = topModal(page);
  await modal.locator('.nt-source-btn', { hasText: 'Rezept' }).click();
  await modal.locator('ion-item', { hasText: TITLE }).waitFor();
  return modal;
}

const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  return document.documentElement.scrollWidth > vw ? [`Seite ${document.documentElement.scrollWidth - vw}px zu breit`] : [];
});

export function register({ test }) {
  test('w6 consumers: Tagebuch aus Rezept laedt den Verweis nach und traegt kcal und Eiweiss je Portion ein', seed({ recipes: [REF_RECIPE] }), async (page) => {
    const state = await mockWorker(page);
    const modal = await openRecipeList(page);
    assert.match(await modal.locator('ion-item', { hasText: TITLE }).innerText(), /Online-Rezept/);
    await modal.locator('ion-item', { hasText: TITLE }).click();
    await modal.locator('.add-footer__save').waitFor();
    assert.equal(state.detailHits, 1, 'genau ein Nachladen bei der Auswahl');
    await modal.locator('.add-footer__save').click();
    await settle(page);
    const entry = (await readStore(page, 'diary')).find((e) => e.label === TITLE);
    assert.ok(entry, 'Eintrag fehlt');
    assert.equal(entry.facts.kcal, KCAL);
    assert.equal(entry.facts.proteinG, PROTEIN_G);
    assert.equal(entry.servings, 1);
    assert.equal(entry.ref?.recipeId, REF_RECIPE.id);
    const stored = (await readStore(page, 'recipes')).find((r) => r.title === TITLE);
    assert.deepEqual(stored.ingredients, [], 'Speicher bleibt ein Verweis');
  });

  test('w6 consumers: Einkaufsliste aus Rezepten mit KI sendet nur Titel, laedt nichts nach und zeigt die Positionen', seed({ recipes: [REF_RECIPE] }), async (page) => {
    const state = await mockWorker(page);
    await go(page, 'shopping');
    await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click();
    await settle(page, 500);
    await page.locator('[data-testid="own-recipes-toggle"]').click();
    await page.locator('[data-testid="own-plan-btn"]').click();
    await page.locator('.check-row__name', { hasText: 'Rote Linsen' }).waitFor();
    assert.equal(state.detailHits, 0, 'die KI bekommt nur Titel, Nachladen waere unnoetig');
    assert.deepEqual(state.shoppingPayloads[0].recipes, [{ title: TITLE }]);
    assert.equal(await page.locator('[data-testid="own-plan-btn"]').count(), 0, 'Generator schliesst sich, nichts haengt');
  });

  test('w6 consumers: Fehler beim Nachladen zeigt Hinweis, traegt nichts ein und Erneut versuchen funktioniert', seed({ recipes: [REF_RECIPE] }), async (page) => {
    const state = await mockWorker(page);
    state.mode = 'error';
    const modal = await openRecipeList(page);
    await modal.locator('ion-item', { hasText: TITLE }).click();
    const error = modal.locator('[data-testid="recipe-load-error"]');
    await error.waitFor();
    assert.match(await error.innerText(), /nicht erreichbar|nicht geladen/);
    assert.equal(await modal.locator('[data-testid="recipe-loading"]').count(), 0, 'Ladezustand haengt nicht');
    assert.equal(await modal.locator('.add-footer__save').count(), 0, 'kein Formular mit leeren Werten');
    assert.equal((await readStore(page, 'diary')).length, 0, 'nichts eingetragen');
    state.mode = 'ok';
    await error.locator('ion-button', { hasText: 'Erneut versuchen' }).click();
    await modal.locator('.add-footer__save').waitFor();
    assert.equal(await modal.locator('[data-testid="recipe-load-error"]').count(), 0);
  });

  for (const vp of VIEWPORTS) {
    test(`w6 consumers: Fehlerzustand im Tagebuch passt bei ${vp.width} px ohne Ueberlauf`, seed({ recipes: [REF_RECIPE] }), async (page) => {
      await page.setViewportSize(vp);
      const state = await mockWorker(page);
      state.mode = 'error';
      const modal = await openRecipeList(page);
      await modal.locator('ion-item', { hasText: TITLE }).click();
      const error = modal.locator('[data-testid="recipe-load-error"]');
      await error.waitFor();
      await settle(page, 400);
      assert.deepEqual(await overflow(page), []);
      const box = await error.locator('ion-button').boundingBox();
      await eventually(async () => assert.ok(box && box.height >= MIN_TOUCH_PX - 1, `Erneut versuchen unter ${MIN_TOUCH_PX} px bei ${vp.width}`));
    });
  }
}
