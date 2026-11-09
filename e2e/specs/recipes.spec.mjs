// Rezepte: anlegen mit 1,5 Portionen Ergiebigkeit, ins Tagebuch loggen (Rezeptseite und halbe Portion im Tagebuch).
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { amountInput, fillAndBlur, pickActionSheet, stepTo, topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const TITLE = 'E2E Linsentopf';
const byAria = (scope, label) => scope.locator(`ion-input input[aria-label="${label}"]`);

/** Legt das Rezept an: 1 Zutat (300 g, 100 kcal/100 g → 300 kcal), ergibt 1,5 Portionen. */
async function createRecipe(page) {
  await go(page, 'recipes');
  await page.locator('.page-head__add').click();
  const modal = topModal(page);
  await modal.locator('.nt-sheet-header__title', { hasText: 'Neues Rezept' }).waitFor();
  await fillAndBlur(byAria(modal, 'Name'), TITLE);
  await modal.locator('.nt-add-btn', { hasText: 'manuelle Zutat' }).click();
  await fillAndBlur(byAria(modal, 'Zutatname'), 'Rote Linsen');
  await amountInput(modal, 'Menge').first().fill('300');
  await modal.locator('.ing-facts-toggle').first().click();
  await fillAndBlur(byAria(modal, 'kcal je 100g'), '100');
  await fillAndBlur(byAria(modal, 'Eiweiß je 100g'), '24,5');
  await stepTo(modal, 'Ergibt Portionen', { start: 2, step: 0.5, target: 1.5 });
  await modal.locator('.save-btn').click();
  await settle(page);
}

export function register({ test }) {
  test('recipes: anlegen mit 1,5 Portionen und halbe Portion loggen', seed(), async (page) => {
    await createRecipe(page);
    const recipe = (await readStore(page, 'recipes')).find((r) => r.title === TITLE);
    assert.ok(recipe, 'Rezept nicht gespeichert');
    assert.equal(recipe.servings, 1.5);
    assert.equal(recipe.factsPerServing?.kcal, 200, '300 kcal gesamt / 1,5 Portionen = 200 kcal je Portion');
    assert.equal(recipe.factsPerServing?.proteinG, 49);

    const card = page.locator('article.recipe', { hasText: TITLE });
    await assert.match(await card.innerText(), /1,5 Portionen/);
    await card.locator('ion-button', { hasText: 'Eintragen' }).click();
    await pickActionSheet(page, 'Mittagessen');
    await pickActionSheet(page, '0,5 Portionen');
    const logged = await eventually(async () => {
      const e = (await readStore(page, 'diary')).find((d) => d.label === TITLE);
      assert.ok(e, 'Rezept nicht im Tagebuch');
      return e;
    });
    assert.equal(logged.meal, 'lunch');
    assert.equal(logged.servings, 0.5);
    assert.equal(logged.facts.kcal, 100);
    assert.equal(logged.ref?.kind, 'recipe');
  });

  test('recipes: halbe Portion über Tagebuch loggen', seed(), async (page) => {
    await createRecipe(page);
    await go(page, 'diary');
    await page.locator('.page-head__add').click();
    const modal = topModal(page);
    await modal.locator('.nt-source-btn', { hasText: 'Rezept' }).click();
    await modal.locator('ion-item', { hasText: TITLE }).click();
    const portions = amountInput(modal, 'Portionen');
    await portions.fill('0,5');
    await eventually(async () => assert.match(await modal.locator('.preview').innerText(), /^\s*100\s*kcal/));
    await modal.locator('.add-footer__save').click();
    await settle(page);
    const e = (await readStore(page, 'diary')).find((d) => d.label === TITLE);
    assert.equal(e?.servings, 0.5);
    assert.equal(e?.facts.kcal, 100);
  });

  test('recipes: gespeichertes Rezept über das Karten-Menü bearbeiten (gleiche id)', seed(), async (page) => {
    await createRecipe(page);
    const before = (await readStore(page, 'recipes')).find((r) => r.title === TITLE);
    const card = page.locator('article.recipe', { hasText: TITLE });
    await card.locator('.recipe__icon-btn').click();
    await pickActionSheet(page, 'Bearbeiten');
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Rezept bearbeiten' }).waitFor();
    assert.equal(await byAria(modal, 'Name').inputValue(), TITLE, 'Editor nicht vorbefüllt');
    await fillAndBlur(byAria(modal, 'Name'), TITLE + ' neu');
    await modal.locator('.save-btn').click();
    await settle(page);
    const all = await readStore(page, 'recipes');
    assert.equal(all.length, 1);
    assert.equal(all[0].id, before.id);
    assert.equal(all[0].title, TITLE + ' neu');
  });

  test('recipes: Detail-Sheet hat Bearbeiten', seed(), async (page) => {
    await createRecipe(page);
    await page.locator('.recipe__title-btn', { hasText: TITLE }).click();
    const sheet = topModal(page);
    await sheet.locator('ion-button', { hasText: 'Bearbeiten' }).first().click();
    await settle(page);
    await topModal(page).locator('.nt-sheet-header__title', { hasText: 'Rezept bearbeiten' }).waitFor();
  });

  test('recipes: Online-Suche ohne eigenen Schlüssel nutzt den Worker (503 → Hinweis, keine Einrichtung)', seed(), async (page) => {
    const hits = [];
    await page.route('https://*.workers.dev/recipes/complexSearch**', async (route) => {
      const req = route.request();
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      hits.push(req.headers()['x-api-key'] ?? null);
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: cors,
        body: '{"error":"Rezept-Suche nicht eingerichtet."}',
      });
    });
    await go(page, 'recipes');
    await page.locator('[data-testid="online-search-btn"]').click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Rezepte online' }).waitFor();
    assert.equal(await modal.locator('[data-testid="os-no-key"]').count(), 0, 'Einrichtung darf mit globalem Worker nicht erscheinen');
    await modal.locator('ion-input input[aria-label="Rezept suchen"]').fill('lentil');
    await modal.locator('.os-search-btn').click();
    await modal.locator('.os-error').waitFor();
    assert.match(await modal.locator('.os-error').innerText(), /nicht eingerichtet/);
    assert.deepEqual(hits, [null], 'genau eine Worker-Anfrage ohne x-api-key');
  });

  test('recipes: Online-Suche (gemockt) finden, öffnen, speichern', seed({ 'recipe-search-config': { apiKey: 'test-key', baseUrl: 'https://api.spoonacular.com' } }), async (page) => {
    const requests = [];
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'X-Api-Quota-Left' };
    await page.route('https://api.spoonacular.com/**', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      requests.push({ url: req.url(), key: req.headers()['x-api-key'] });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ...cors, 'X-Api-Quota-Left': '41' },
        body: JSON.stringify(MOCK_RESPONSE),
      });
    });

    await go(page, 'recipes');
    await page.locator('[data-testid="online-search-btn"]').click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Rezepte online' }).waitFor();
    await modal.locator('ion-input input[aria-label="Rezept suchen"]').fill('lentil');
    await modal.locator('.os-search-btn').click();
    const card = modal.locator('.os-card', { hasText: 'Mock Lentil Soup' });
    await card.waitFor();
    assert.match(await card.innerText(), /320 kcal/);
    assert.match(await card.innerText(), /2 Portionen/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].key, 'test-key');
    assert.match(requests[0].url, /query=lentil/);
    assert.match(await modal.innerText(), /noch 41 Punkte heute/);

    await card.click();
    const detail = modal.locator('[data-testid="os-detail"]');
    await detail.waitFor();
    assert.match(await detail.innerText(), /Chop the onion/);
    assert.match(await detail.innerText(), /Rote Linsen/);
    assert.equal(await detail.locator('[data-testid="os-untranslated"]').count() > 0 || /nicht übersetzt/.test(await detail.innerText()), true, 'Hinweis nicht übersetzt fehlt');
    assert.match(await detail.innerText(), /Quelle: Mock Blog/);
    await detail.locator('.os-save').click();
    await settle(page);

    const saved = (await readStore(page, 'recipes')).find((r) => r.title === 'Mock Lentil Soup');
    assert.ok(saved, 'Rezept nicht gespeichert');
    assert.equal(saved.origin, 'online');
    assert.equal(saved.servings, 2);
    assert.deepEqual(saved.steps, ['Chop the onion.', 'Simmer the lentils for 20 minutes.']);
    assert.equal(saved.ingredients[0].name, 'Rote Linsen');
    assert.equal(saved.factsPerServing?.kcal, 320);

    await modal.locator('ion-button', { hasText: 'Schließen' }).click();
    await settle(page, 800);
    const listCard = page.locator('article.recipe', { hasText: 'Mock Lentil Soup' });
    await listCard.waitFor();
    assert.match(await listCard.innerText(), /320/);
    await listCard.locator('.recipe__title-btn').click();
    const sheet = topModal(page);
    await eventually(async () => assert.match(await sheet.innerText(), /Simmer the lentils|Linsen/));
  });
}

const MOCK_RESPONSE = {
  offset: 0,
  number: 10,
  totalResults: 1,
  results: [{
    id: 4242,
    title: 'Mock Lentil Soup',
    image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    readyInMinutes: 30,
    servings: 2,
    sourceName: 'Mock Blog',
    sourceUrl: 'https://blog.example/lentil-soup',
    nutrition: {
      nutrients: [
        { name: 'Calories', amount: 320, unit: 'kcal' }, { name: 'Protein', amount: 18, unit: 'g' },
        { name: 'Fat', amount: 6, unit: 'g' }, { name: 'Carbohydrates', amount: 48, unit: 'g' }, { name: 'Fiber', amount: 11, unit: 'g' },
      ],
      ingredients: [
        { id: 1, name: 'red lentils', amount: 200, unit: 'g', nutrients: [{ name: 'Calories', amount: 600, unit: 'kcal' }, { name: 'Protein', amount: 40, unit: 'g' }] },
        { id: 2, name: 'onion', amount: 1, unit: '', nutrients: [{ name: 'Calories', amount: 40, unit: 'kcal' }] },
      ],
    },
    extendedIngredients: [
      { id: 1, name: 'lentils', nameClean: 'red lentils', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' } } },
      { id: 2, name: 'onion', amount: 1, unit: '', measures: { metric: { amount: 1, unitShort: '' } } },
    ],
    analyzedInstructions: [{ name: '', steps: [{ number: 1, step: 'Chop the onion.' }, { number: 2, step: 'Simmer the lentils for 20 minutes.' }] }],
  }],
};
