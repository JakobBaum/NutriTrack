// Welle 6: Fastfood-Land im Profil und Schaltflächen-Zustände des Helfers ("Vorschläge holen" / "Weitere Vorschläge").
import fs from 'node:fs';
import path from 'node:path';
import { assert, go, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const SHOT_DIR = process.env.W6_SHOTS_DIR ?? '';
const facts = (kcal, proteinG, carbsG, fatG) => ({ kcal, proteinG, carbsG, fatG, basis: 'perPortion' });
const item = (itemName) => ({ restaurant: 'McDonald’s', itemName, facts: facts(400, 25, 40, 10), rationale: `${itemName} passt.`, estPrice: 4.5 });
const ROUND = [item('Chicken Wrap'), item('Veggie Burger')];

/** Lokaler KI-Mock: antwortet immer mit ROUND und merkt sich die Anfragen. */
async function mockAi(page) {
  const requests = [];
  await page.route('https://*.workers.dev/**', async (route) => {
    requests.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(ROUND),
    });
  });
  return requests;
}

const shot = async (page, name) => {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
};

async function openFastfood(page) {
  await go(page, 'diary');
  await page.locator('.ff-btn').click();
  await topModal(page).locator('[data-testid="ff-run"]').waitFor();
  await settle(page, 500);
}

/** Wählt im Profil-Sheet ein Land (Action-Sheet) und speichert. */
async function chooseCountryInProfile(page, country) {
  await go(page, 'settings');
  await page.locator('[data-testid="open-profile"]').click();
  const sheet = topModal(page);
  const select = sheet.locator('[data-testid="country-select"]');
  await select.scrollIntoViewIfNeeded();
  await settle(page, 400);
  await select.click();
  await page.locator('ion-action-sheet button', { hasText: country }).click();
  await settle(page, 400);
  await sheet.locator('[data-testid="profile-save"]').click();
  await sheet.waitFor({ state: 'detached', timeout: 6000 }).catch(() => undefined);
  await settle(page, 500);
}

const touchPx = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nt-touch')) || 44);

const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const root = document.querySelector('ion-modal.show-modal') ?? document.body;
  const out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`Seite ${document.documentElement.scrollWidth - vw}px zu breit`);
  for (const el of root.querySelectorAll('.ff-sheet *, .ff-card, .ff-card *, .nt-sheet-footer *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) out.push(`${el.className || el.tagName} ragt heraus (${Math.round(r.right)} > ${vw})`);
  }
  return out;
});

const has = (page, testId) => topModal(page).locator(`[data-testid="${testId}"]`).count();

export function register({ test }) {
  test('w6 fastfood: Land im Profil ändern wirkt im Helfer und geht in die Anfrage ein', seed(), async (page) => {
    const requests = await mockAi(page);
    await chooseCountryInProfile(page, 'Schweiz');
    await openFastfood(page);
    const hint = topModal(page).locator('[data-testid="ff-country"]');
    assert.equal((await hint.innerText()).replace(/\s+/g, ' ').trim(), 'Land: Schweiz, im Profil ändern');
    assert.equal(await topModal(page).locator('ion-select[label="Land"]').count(), 0, 'eigene Länderauswahl im Helfer');
    await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
    await topModal(page).locator('.ff-card').first().waitFor({ timeout: 8000 });
    const suggest = requests.find((r) => r.payload?.kcalBudget !== undefined);
    assert.equal(suggest?.payload.country, 'Schweiz');
  });

  test('w6 fastfood: Link "im Profil ändern" führt ins Profil', seed(), async (page) => {
    await openFastfood(page);
    await topModal(page).locator('[data-testid="ff-country-link"]').click();
    await page.locator('[data-testid="country-select"]').waitFor({ timeout: 8000 });
    assert.ok(page.url().includes('/settings'), `URL: ${page.url()}`);
  });

  for (const vp of VIEWPORTS) {
    test(`w6 fastfood ${vp.width}px: Profil-Abschnitt Land ohne Überlauf`, seed(), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'settings');
      await page.locator('[data-testid="open-profile"]').click();
      const select = topModal(page).locator('[data-testid="country-select"]');
      await select.scrollIntoViewIfNeeded();
      await settle(page, 500);
      assert.deepEqual(await overflow(page), []);
      const box = await select.boundingBox();
      assert.ok(box && box.height >= await touchPx(page), `Länderfeld zu niedrig: ${box?.height}`);
      await shot(page, `profil-land-${vp.width}`);
    });

    test(`w6 fastfood ${vp.width}px: Schaltflächen vor der Runde, nach der Runde und nach Änderung`, seed(), async (page) => {
      await page.setViewportSize(vp);
      await mockAi(page);
      await openFastfood(page);
      const touch = await touchPx(page);

      assert.equal(await has(page, 'ff-run'), 1, 'vor der Runde: Vorschläge holen');
      assert.equal(await has(page, 'ff-more'), 0, 'vor der Runde: kein Weitere Vorschläge');
      const link = await topModal(page).locator('[data-testid="ff-country-link"]').boundingBox();
      assert.ok(link && link.height >= touch, `Länder-Link zu niedrig: ${link?.height}`);
      assert.deepEqual(await overflow(page), []);
      await shot(page, `helfer-vor-runde-${vp.width}`);

      await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
      await topModal(page).locator('.ff-card').first().waitFor({ timeout: 8000 });
      await settle(page, 600);
      assert.equal(await has(page, 'ff-run'), 0, 'nach der Runde: kein Vorschläge holen');
      assert.equal(await has(page, 'ff-more'), 1, 'nach der Runde: Weitere Vorschläge');
      const more = await topModal(page).locator('[data-testid="ff-more"]').boundingBox();
      assert.ok(more && more.height >= touch, `Weitere Vorschläge zu niedrig: ${more?.height}`);
      assert.deepEqual(await overflow(page), []);
      await shot(page, `helfer-nach-runde-${vp.width}`);

      await topModal(page).locator('.ff-chip', { hasText: 'Günstig' }).click();
      await settle(page, 300);
      assert.equal(await has(page, 'ff-run'), 1, 'nach Änderung: Vorschläge holen');
      assert.equal(await has(page, 'ff-more'), 0, 'nach Änderung: kein Weitere Vorschläge');
      assert.equal(await topModal(page).locator('.ff-card').count(), 2, 'Liste bleibt stehen');
      assert.equal(await has(page, 'ff-stale'), 1, 'Hinweis auf geänderte Auswahl');
      await shot(page, `helfer-nach-aenderung-${vp.width}`);

      await topModal(page).locator('.ff-chip', { hasText: 'Günstig' }).click();
      await settle(page, 300);
      assert.equal(await has(page, 'ff-more'), 1, 'Änderung zurückgenommen: Weitere Vorschläge');
      assert.equal(await has(page, 'ff-run'), 0);
    });
  }

  test('w6 fastfood: Änderung vor "Weitere Vorschläge" geht als neue Anfrage ohne Ausschlussliste raus', seed(), async (page) => {
    const requests = await mockAi(page);
    await openFastfood(page);
    await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
    await topModal(page).locator('.ff-card').first().waitFor({ timeout: 8000 });
    await topModal(page).locator('.ff-chip', { hasText: 'Günstig' }).click();
    await settle(page, 300);
    await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
    await page.waitForFunction(() => document.querySelectorAll('ion-modal.show-modal [data-testid="ff-more"]').length === 1, null, { timeout: 8000 });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1].payload.exclude, []);
    assert.ok(requests[1].payload.preferences.includes('günstig'));
  });
}
