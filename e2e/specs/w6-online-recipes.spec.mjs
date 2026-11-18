// Welle 6: gespeicherte Online-Rezepte sind nur Verweise (ID, Titel, Bild); Details kommen beim Öffnen aus dem Netz.
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_TOUCH_PX = 36; // Sicherheitsnetz; kompakt = --nt-btn-height 36
const RECIPE_ID = 4242;
const TITLE = 'Mock Lentil Soup';
const OFFLINE_MESSAGE = 'Dieses Rezept stammt von Spoonacular und braucht eine Internetverbindung.';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

const RECIPE = {
  id: RECIPE_ID,
  title: TITLE,
  image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  readyInMinutes: 30,
  servings: 2,
  sourceName: 'Mock Blog',
  sourceUrl: 'https://blog.example/lentil-soup',
  nutrition: {
    nutrients: [
      { name: 'Calories', amount: 320, unit: 'kcal' }, { name: 'Protein', amount: 18, unit: 'g' },
      { name: 'Fat', amount: 6, unit: 'g' }, { name: 'Carbohydrates', amount: 48, unit: 'g' },
    ],
  },
  extendedIngredients: [
    { id: 1, name: 'lentils', nameClean: 'red lentils', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' } } },
  ],
  analyzedInstructions: [{ name: '', steps: [{ number: 1, step: 'Simmer the lentils.' }] }],
};

/** Mock für Suche und Detail; `mode` steuert die Detail-Antwort ('ok' | 'error' | 'gone'), `detailHits` zählt Abrufe. */
async function mockWorker(page) {
  const state = { mode: 'ok', detailHits: 0 };
  await page.route('https://*.workers.dev/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.includes('/recipes/complexSearch')) {
      const body = { offset: 0, number: 10, totalResults: 1, results: [RECIPE] };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    }
    if (url.includes(`/recipes/${RECIPE_ID}/information`)) {
      state.detailHits += 1;
      if (state.mode === 'error') return route.fulfill({ status: 500, contentType: 'application/json', headers: CORS, body: '{"error":"x"}' });
      if (state.mode === 'gone') return route.fulfill({ status: 404, contentType: 'application/json', headers: CORS, body: '{"error":"x"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(RECIPE) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' });
  });
  return state;
}

/** Sucht, öffnet den Treffer, speichert ihn als Rezept und schließt die Suche. */
async function saveOnlineRecipe(page) {
  await go(page, 'recipes');
  await page.locator('[data-testid="online-search-btn"]').click();
  const modal = topModal(page);
  await modal.locator('.nt-sheet-header__title', { hasText: 'Rezepte online' }).waitFor();
  await modal.locator('ion-input input[aria-label="Rezept suchen"]').fill('lentil');
  await modal.locator('.os-search-btn').click();
  await modal.locator('.os-card', { hasText: TITLE }).click();
  const save = modal.locator('[data-testid="os-detail"] .os-save');
  await eventually(async () => assert.equal(await save.isDisabled(), false));
  await save.click();
  await settle(page);
  await modal.locator('ion-button.nt-sheet-close').click();
  await settle(page, 800);
}

const openSavedDetail = async (page) => {
  await page.locator('article.recipe', { hasText: TITLE }).locator('.recipe__title-btn').click();
  return topModal(page);
};

const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  return document.documentElement.scrollWidth > vw ? [`Seite ${document.documentElement.scrollWidth - vw}px zu breit`] : [];
});

export function register({ test }) {
  test('w6: Speichern aus der Online-Suche legt nur den Verweis ab, keine Zutaten oder Schritte', seed(), async (page) => {
    await mockWorker(page);
    await saveOnlineRecipe(page);
    const stored = await readStore(page, 'recipes');
    const saved = stored.find((r) => r.title === TITLE);
    assert.ok(saved, 'Verweis nicht gespeichert');
    assert.equal(saved.onlineRef?.source, 'spoonacular');
    assert.equal(saved.onlineRef?.externalId, String(RECIPE_ID));
    assert.deepEqual(saved.ingredients, [], 'Zutaten dürfen nicht gespeichert werden');
    assert.deepEqual(saved.steps, [], 'Schritte dürfen nicht gespeichert werden');
    assert.equal(saved.factsPerServing, undefined, 'Nährwerte dürfen nicht gespeichert werden');
    assert.equal(JSON.stringify(stored).includes('Simmer'), false, 'kein Anleitungstext im Speicher');
    assert.equal(JSON.stringify(stored).includes('lentils'), false, 'kein Zutatentext im Speicher');
    const card = page.locator('article.recipe', { hasText: TITLE });
    assert.match(await card.innerText(), /Online-Rezept/);
  });

  test('w6: Öffnen lädt die Details nach und zeigt Zutaten, Schritte und Quellenangabe', seed(), async (page) => {
    const state = await mockWorker(page);
    await saveOnlineRecipe(page);
    const before = state.detailHits;
    const sheet = await openSavedDetail(page);
    await eventually(async () => assert.match(await sheet.innerText(), /Simmer the lentils|Linsen/));
    assert.equal(state.detailHits, before + 1, 'genau ein Nachladen beim Öffnen');
    assert.match(await sheet.innerText(), /spoonacular\.com/);
    const stored = (await readStore(page, 'recipes')).find((r) => r.title === TITLE);
    assert.deepEqual(stored.ingredients, [], 'auch nach dem Laden bleibt der Speicher ein Verweis');
  });

  test('w6: Fehler beim Nachladen zeigt die Meldung und Erneut versuchen lädt das Rezept', seed(), async (page) => {
    const state = await mockWorker(page);
    await saveOnlineRecipe(page);
    state.mode = 'error';
    const sheet = await openSavedDetail(page);
    const error = sheet.locator('[data-testid="online-error"]');
    await error.waitFor();
    assert.match(await error.innerText(), /nicht erreichbar|nicht geladen/);
    const retry = error.locator('ion-button', { hasText: 'Erneut versuchen' });
    assert.ok(await retry.boundingBox().then((b) => b && b.height >= MIN_TOUCH_PX - 1), `Erneut versuchen unter ${MIN_TOUCH_PX} px`);
    state.mode = 'ok';
    await retry.click();
    await eventually(async () => assert.match(await sheet.innerText(), /Simmer the lentils|Linsen/));
    assert.equal(await sheet.locator('[data-testid="online-error"]').count(), 0);
  });

  test('w6: Rezept bei Spoonacular entfernt (404) bietet Verweis löschen an', seed(), async (page) => {
    const state = await mockWorker(page);
    await saveOnlineRecipe(page);
    state.mode = 'gone';
    const sheet = await openSavedDetail(page);
    const error = sheet.locator('[data-testid="online-error"]');
    await error.waitFor();
    assert.match(await error.innerText(), /nicht mehr/);
    await error.locator('ion-button', { hasText: 'Verweis löschen' }).click();
    await settle(page, 600);
    // Löschen läuft über „Rückgängig“-Hinweis: die Karte ist sofort weg.
    assert.equal(await page.locator('article.recipe', { hasText: TITLE }).count(), 0, 'der Verweis muss aus der Liste verschwinden');
  });

  test('w6: Offline zeigt den Hinweis zu Spoonacular und der Verweis bleibt erhalten', seed(), async (page) => {
    await mockWorker(page);
    await saveOnlineRecipe(page);
    await page.context().setOffline(true);
    const sheet = await openSavedDetail(page);
    const error = sheet.locator('[data-testid="online-error"]');
    await error.waitFor();
    assert.match(await error.innerText(), new RegExp(OFFLINE_MESSAGE.replace('.', '\\.')));
    await page.context().setOffline(false);
    const stored = await readStore(page, 'recipes');
    assert.ok(stored.some((r) => r.title === TITLE), 'der Verweis darf offline nicht verloren gehen');
  });

  for (const vp of VIEWPORTS) {
    test(`w6: Fehlerzustand passt bei ${vp.width} px ohne Überlauf`, seed(), async (page) => {
      await page.setViewportSize(vp);
      const state = await mockWorker(page);
      await saveOnlineRecipe(page);
      state.mode = 'gone';
      const sheet = await openSavedDetail(page);
      await sheet.locator('[data-testid="online-error"]').waitFor();
      await settle(page, 400);
      assert.deepEqual(await overflow(page), []);
      for (const btn of await sheet.locator('[data-testid="online-error"] ion-button').all()) {
        const box = await btn.boundingBox();
        assert.ok(box && box.height >= MIN_TOUCH_PX - 1, `Button unter ${MIN_TOUCH_PX} px bei ${vp.width}`);
      }
    });
  }
}
