// Rezepte: anlegen mit 0,5 Portionen, ins Tagebuch loggen (Rezeptseite und halbe Portion im Tagebuch).
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { fillAndBlur, ionInput, pickActionSheet, topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const TITLE = 'E2E Linsentopf';
const byAria = (scope, label) => scope.locator(`ion-input input[aria-label="${label}"]`);

/** Legt das Rezept an: 1 Zutat (200 g, 100 kcal/100 g → 200 kcal), 0,5 Portionen. */
async function createRecipe(page) {
  await go(page, 'recipes');
  await page.locator('.page-head__add').click();
  const modal = topModal(page);
  await modal.locator('ion-title', { hasText: 'Neues Rezept' }).waitFor();
  await fillAndBlur(byAria(modal, 'Name'), TITLE);
  await modal.locator('.link-add').click();
  await fillAndBlur(byAria(modal, 'Zutatname'), 'Rote Linsen');
  await fillAndBlur(byAria(modal, 'Menge'), '200');
  await modal.locator('.ing-facts-toggle').first().click();
  await modal.locator('ion-button', { hasText: 'Nährwerte eintragen' }).click();
  await fillAndBlur(byAria(modal, 'kcal je 100g'), '100');
  await fillAndBlur(byAria(modal, 'Eiweiß je 100g'), '24,5');
  await fillAndBlur(byAria(modal, 'Portionen'), '0,5');
  await modal.locator('.save-btn').click();
  await settle(page);
}

export function register({ test }) {
  test('recipes: anlegen mit 0,5 Portionen und loggen', seed(), async (page) => {
    await createRecipe(page);
    const recipe = (await readStore(page, 'recipes')).find((r) => r.title === TITLE);
    assert.ok(recipe, 'Rezept nicht gespeichert');
    assert.equal(recipe.servings, 0.5);
    assert.equal(recipe.factsPerServing?.kcal, 400, '200 kcal gesamt / 0,5 Portionen = 400 kcal je Portion');
    assert.equal(recipe.factsPerServing?.proteinG, 98);

    const card = page.locator('article.recipe', { hasText: TITLE });
    await assert.match(await card.innerText(), /0,5 Portionen/);
    await card.locator('ion-button', { hasText: 'Tagebuch' }).click();
    await pickActionSheet(page, 'Mittagessen');
    const logged = await eventually(async () => {
      const e = (await readStore(page, 'diary')).find((d) => d.label === TITLE);
      assert.ok(e, 'Rezept nicht im Tagebuch');
      return e;
    });
    assert.equal(logged.meal, 'lunch');
    assert.equal(logged.facts.kcal, 400);
    assert.equal(logged.ref?.kind, 'recipe');
  });

  test('recipes: halbe Portion über Tagebuch loggen', seed(), async (page) => {
    await createRecipe(page);
    await go(page, 'diary');
    await page.locator('.page-head__add').click();
    const modal = topModal(page);
    await modal.locator('.source-btn', { hasText: 'Rezept' }).click();
    await modal.locator('ion-item', { hasText: TITLE }).click();
    const portions = ionInput(modal, 'Portionen');
    await portions.fill('0,5');
    await eventually(async () => assert.match(await modal.locator('.preview').innerText(), /^\s*200\s*kcal/));
    await modal.locator('.add-footer__save').click();
    await settle(page);
    const e = (await readStore(page, 'diary')).find((d) => d.label === TITLE);
    assert.equal(e?.servings, 0.5);
    assert.equal(e?.facts.kcal, 200);
  });
}
