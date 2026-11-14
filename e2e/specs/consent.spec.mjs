// Zustimmung zu KI- und Online-Funktionen: ohne Zustimmung geht keine Anfrage an den Worker hinaus.
import { assert, go, settle, readStore } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_TOUCH_PX = 44;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const DECLINE_MESSAGE = /Zustimmung zu den Online-Funktionen/;

const RECIPE_RESPONSE = {
  offset: 0,
  number: 10,
  totalResults: 1,
  results: [{
    id: 4242,
    title: 'Mock Lentil Soup',
    readyInMinutes: 30,
    servings: 2,
    nutrition: { nutrients: [{ name: 'Calories', amount: 320, unit: 'kcal' }, { name: 'Protein', amount: 18, unit: 'g' }] },
    extendedIngredients: [{ id: 1, name: 'lentils', nameClean: 'red lentils', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' } } }],
    analyzedInstructions: [{ name: '', steps: [{ number: 1, step: 'Simmer the lentils.' }] }],
  }],
};
const FASTFOOD_RESPONSE = [{
  restaurant: 'McDonald’s', itemName: 'Chicken Wrap', rationale: 'Passt gut ins Budget.', estPrice: 4.5,
  facts: { kcal: 350, proteinG: 30, carbsG: 30, fatG: 10, basis: 'perPortion' },
}];

/**
 * Der echte Worker bleibt gesperrt: ein lokaler Mock antwortet und zählt die Anfragen.
 * Gezählt werden nur Anfragen mit Inhalt; der Erreichbarkeitstest (ping, health) trägt keine Nutzerdaten.
 */
async function mockWorker(page) {
  const sent = [];
  await page.route('https://*.workers.dev/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = req.url();
    const fn = req.method() === 'POST' ? JSON.parse(req.postData() ?? '{}').fn : null;
    const isProbe = fn === 'ping' || url.includes('/health');
    if (!isProbe) sent.push({ url, fn });
    const body = url.includes('/recipes/complexSearch') ? RECIPE_RESPONSE : FASTFOOD_RESPONSE;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
  return sent;
}

async function startOnlineSearch(page) {
  await go(page, 'recipes');
  await page.locator('[data-testid="online-search-btn"]').click();
  const modal = topModal(page);
  await modal.locator('.nt-sheet-header__title', { hasText: 'Rezepte online' }).waitFor();
  await modal.locator('ion-input input[aria-label="Rezept suchen"]').fill('lentil');
  await modal.locator('.os-search-btn').click();
}

const consentDialog = (page) => page.locator('[data-testid="consent-dialog"]');
const isDisabled = (locator) => locator.evaluate((el) => el.disabled === true || el.hasAttribute('disabled'));

async function waitForDialog(page) {
  await consentDialog(page).waitFor();
  await settle(page, 400);
}

const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`Seite ${document.documentElement.scrollWidth - vw}px zu breit`);
  const dialog = document.querySelector('[data-testid="consent-dialog"]');
  for (const el of dialog?.closest('ion-modal')?.querySelectorAll('*') ?? []) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) out.push(`${el.className || el.tagName} ragt heraus (${Math.round(r.right)} > ${vw})`);
  }
  return out;
});

export function register({ test }) {
  test('consent: ohne Zustimmung geht keine Rezeptsuche hinaus und der Dialog erscheint', seed({ consent: null }), async (page) => {
    const sent = await mockWorker(page);
    await startOnlineSearch(page);
    await waitForDialog(page);
    assert.deepEqual(sent, [], 'ohne Zustimmung darf keine Anfrage mit Inhalt an den Worker gehen');
    assert.match(await consentDialog(page).innerText(), /Gemini/);
  });

  test('consent: ohne Zustimmung geht keine Fastfood-Anfrage hinaus und der Dialog erscheint', seed({ consent: null }), async (page) => {
    const sent = await mockWorker(page);
    await go(page, 'diary');
    await page.locator('.ff-btn').click();
    await topModal(page).locator('[data-testid="ff-run"]').waitFor();
    await settle(page, 500);
    await topModal(page).locator('[data-testid="ff-run"]').click({ force: true });
    await waitForDialog(page);
    assert.deepEqual(sent, [], 'ohne Zustimmung darf keine Anfrage mit Inhalt an den Worker gehen');
  });

  test('consent: Zustimmen bleibt gesperrt, bis 18+ bestätigt ist', seed({ consent: null }), async (page) => {
    await mockWorker(page);
    await startOnlineSearch(page);
    await waitForDialog(page);
    const accept = page.locator('[data-testid="consent-accept"]');
    assert.equal(await isDisabled(accept), true, 'Zustimmen darf ohne Häkchen nicht aktiv sein');
    await page.locator('[data-testid="consent-adult"]').click();
    await settle(page, 300);
    assert.equal(await isDisabled(accept), false, 'mit Häkchen muss Zustimmen aktiv sein');
  });

  test('consent: nach Zustimmung läuft die Anfrage und die Treffer erscheinen', seed({ consent: null }), async (page) => {
    const sent = await mockWorker(page);
    await startOnlineSearch(page);
    await waitForDialog(page);
    await page.locator('[data-testid="consent-adult"]').click();
    await settle(page, 300);
    await page.locator('[data-testid="consent-accept"]').click();
    await topModal(page).locator('.os-card', { hasText: 'Mock Lentil Soup' }).waitFor();
    assert.equal(sent.filter((r) => r.url.includes('/recipes/complexSearch')).length, 1, 'genau eine Suchanfrage nach der Zustimmung');
    const stored = await readStore(page, 'consent');
    assert.equal(stored.isAdultConfirmed, true);
    assert.equal(typeof stored.acceptedAt, 'string');
  });

  test('consent: Nicht jetzt zeigt die Meldung, ohne dass ein Ladezustand hängt', seed({ consent: null }), async (page) => {
    const sent = await mockWorker(page);
    await startOnlineSearch(page);
    await waitForDialog(page);
    await page.locator('[data-testid="consent-decline"]').click();
    const modal = topModal(page);
    await modal.locator('.os-error').waitFor();
    assert.match(await modal.locator('.os-error').innerText(), DECLINE_MESSAGE);
    assert.equal(await modal.locator('ion-spinner').count(), 0, 'es darf kein Ladekreisel hängen bleiben');
    assert.equal(await isDisabled(modal.locator('.os-search-btn')), false, 'Suchen muss wieder bedienbar sein');
    assert.deepEqual(sent, []);
  });

  test('consent: Widerruf unter Profil sperrt die Funktionen wieder', seed(), async (page) => {
    const sent = await mockWorker(page);
    await go(page, 'settings');
    const status = page.locator('[data-testid="consent-status"]');
    assert.match(await status.innerText(), /Zugestimmt/);
    await page.locator('[data-testid="consent-revoke"]').click();
    await settle(page, 400);
    assert.match(await status.innerText(), /Nicht zugestimmt/);
    assert.equal(await readStore(page, 'consent'), null, 'die Zustimmung muss gelöscht sein');
    await startOnlineSearch(page);
    await waitForDialog(page);
    assert.deepEqual(sent, [], 'nach dem Widerruf geht nichts mehr hinaus');
  });

  for (const vp of VIEWPORTS) {
    test(`consent ${vp.width}px: Dialog ohne Überlauf, Buttons mindestens 44 px hoch`, seed({ consent: null }), async (page) => {
      await page.setViewportSize(vp);
      await mockWorker(page);
      await startOnlineSearch(page);
      await waitForDialog(page);
      assert.deepEqual(await overflow(page), []);
      const heights = await page.locator('[data-testid="consent-accept"], [data-testid="consent-decline"]')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      assert.equal(heights.length, 2, 'beide Buttons müssen sichtbar sein');
      assert.ok(heights.every((h) => h >= MIN_TOUCH_PX), `Buttons zu niedrig: ${heights}`);
    });
  }
}
