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
}
