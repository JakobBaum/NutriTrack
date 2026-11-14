// Welle 3: Fastfood-Helfer mit Mehrfach-Kriterien, Land, "Weitere Vorschläge" und geprüften KI-Antworten.
import { assert, go, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const OLD_WORKER_PREFERENCE_MAX = 60;
const facts = (kcal, proteinG, carbsG, fatG) => ({ kcal, proteinG, carbsG, fatG, basis: 'perPortion' });
const item = (itemName, f) => ({ restaurant: 'McDonald’s', itemName, facts: f, rationale: `${itemName} passt gut ins Budget.`, estPrice: 4.5 });

const ROUNDS = [
  [
    item('Chicken Wrap', facts(350, 30, 30, 10)),
    item('Veggie Burger', facts(420, 20, 50, 15)),
    item('Unsinn-Burger', facts(5000, 1, 1, 1)),
  ],
  [item('veggie burger', facts(420, 20, 50, 15)), item('Salat Bowl', facts(280, 20, 20, 12))],
];

/** Der echte Worker bleibt gesperrt: ein lokaler Mock antwortet je Runde und merkt sich die Anfragen. */
async function mockAi(page) {
  const requests = [];
  await page.route('https://*.workers.dev/**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    requests.push(body);
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(ROUNDS[Math.min(requests.length, ROUNDS.length) - 1]),
    });
  });
  return requests;
}

async function openFastfood(page) {
  await go(page, 'diary');
  await page.locator('.ff-btn').click();
  await topModal(page).locator('[data-testid="ff-run"]').waitFor();
  await settle(page, 500);
}

const chip = (page, label) => topModal(page).locator('.ff-chip', { hasText: label });
/** Tippt ein Kriterium an und wartet, bis die Anzeige nachgezogen hat. */
const tapChip = async (page, label) => { await chip(page, label).click(); await settle(page, 200); };
const pressed = (page) => topModal(page).locator('.ff-chip[aria-pressed="true"]').allInnerTexts();
const cardNames = (page) => topModal(page).locator('.ff-card ion-card-title').allInnerTexts();

const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const root = document.querySelector('ion-modal.show-modal') ?? document.body;
  const out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`Seite ${document.documentElement.scrollWidth - vw}px zu breit`);
  for (const el of root.querySelectorAll('.ff-sheet *, .ff-card, .ff-card *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) out.push(`${el.className || el.tagName} ragt heraus (${Math.round(r.right)} > ${vw})`);
  }
  return out;
});

export function register({ test }) {
  test('w3 fastfood: Mehrfachauswahl 1 bis 4, aria-pressed, 44 px, Land mit Vorgabe Österreich', seed(), async (page) => {
    await openFastfood(page);
    assert.deepEqual(await pressed(page), ['Viel Eiweiß']);
    await tapChip(page, 'Günstig');
    assert.deepEqual((await pressed(page)).sort(), ['Günstig', 'Viel Eiweiß']);
    await tapChip(page, 'Wenig Zucker');
    await tapChip(page, 'Sättigend');
    await tapChip(page, 'Vegetarisch');
    assert.equal((await pressed(page)).length, 4, 'höchstens 4 Kriterien');
    await tapChip(page, 'Viel Eiweiß');
    await tapChip(page, 'Günstig');
    await tapChip(page, 'Wenig Zucker');
    await tapChip(page, 'Sättigend');
    assert.equal((await pressed(page)).length, 1, 'mindestens 1 Kriterium bleibt');
    const heights = await topModal(page).locator('.ff-chip').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    assert.ok(heights.every((h) => h >= 44), `Chips zu niedrig: ${heights}`);
    const country = await topModal(page).locator('ion-select[label="Land"]').evaluate((el) => ({
      value: el.value, shown: el.shadowRoot?.querySelector('.select-text')?.textContent?.trim() ?? '',
    }));
    assert.equal(country.value, 'Österreich');
    assert.equal(country.shown, 'Österreich');
  });

  for (const vp of VIEWPORTS) {
    test(`w3 fastfood ${vp.width}px: Vorschläge, Weitere Vorschläge ohne Duplikate, ungültiger Eintrag fehlt, kein Überlauf`, seed(), async (page) => {
      await page.setViewportSize(vp);
      const requests = await mockAi(page);
      await openFastfood(page);
      await chip(page, 'Günstig').click();
      await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
      await topModal(page).locator('.ff-card').first().waitFor({ timeout: 8000 });
      await settle(page, 600);

      assert.deepEqual((await cardNames(page)).sort(), ['Chicken Wrap', 'Veggie Burger']);
      assert.ok(!(await topModal(page).innerText()).includes('Unsinn-Burger'), 'ungültiger KI-Eintrag wird angezeigt');
      const first = requests[0].payload;
      assert.deepEqual(first.preferences.sort(), ['günstig', 'viel Protein']);
      assert.equal(first.country, 'Österreich');
      assert.ok(first.preference.length < OLD_WORKER_PREFERENCE_MAX, 'preference für alten Worker zu lang');
      assert.deepEqual(first.exclude, []);
      assert.deepEqual(await overflow(page), []);

      const more = topModal(page).locator('[data-testid="ff-more"]');
      await more.scrollIntoViewIfNeeded();
      await more.click();
      await page.waitForFunction(() => document.querySelectorAll('ion-modal.show-modal .ff-card').length >= 3, null, { timeout: 8000 });
      await settle(page, 500);
      const names = await cardNames(page);
      assert.equal(names.length, 3, `erwartet 3 Karten ohne Duplikat, da: ${names}`);
      assert.equal(new Set(names.map((n) => n.toLowerCase())).size, 3);
      assert.deepEqual(requests[1].payload.exclude.sort(), ['Chicken Wrap', 'Veggie Burger']);
      assert.deepEqual(await overflow(page), []);
    });
  }

  test('w3 fastfood: Änderung am Formular beginnt die Liste neu', seed(), async (page) => {
    await mockAi(page);
    await openFastfood(page);
    await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
    await topModal(page).locator('.ff-card').first().waitFor({ timeout: 8000 });
    await chip(page, 'Günstig').click();
    await settle(page, 300);
    assert.equal(await topModal(page).locator('.ff-card').count(), 0);
    assert.equal(await topModal(page).locator('[data-testid="ff-more"]').count(), 0);
  });
}
