// Barcode-Scan (gefakter Kamera-Stream mit EAN-13): kein Absturz, UI danach bedienbar, Kamera frei, Zeitbudget.
import { assert, eventually, go, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { fakeCameraInit } from '../lib/fake-camera.mjs';
import { seed } from '../lib/fixtures.mjs';

const CODE = '4000417025005';
/** Obergrenze Tippen auf "Barcode" bis Formular mit Produkt (lokal, OFF gemockt). */
const SCAN_BUDGET_MS = 3500;

const OFF_PRODUCT = {
  status: 'success',
  product: {
    code: CODE, product_name: 'Haferdrink Natur', brands: 'Alpro',
    nutriments: { 'energy-kcal_100g': 45, proteins_100g: 1, carbohydrates_100g: 6.5, fat_100g: 1.5 },
  },
};

async function mockLookups(page) {
  await page.route((url) => url.hostname === 'world.openfoodfacts.org', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(OFF_PRODUCT),
  }));
  await page.route((url) => url.hostname === 'prices.openfoodfacts.org', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"items":[]}',
  }));
}

async function openScanner(page) {
  await page.addInitScript(fakeCameraInit({ code: CODE }));
  await mockLookups(page);
  await go(page, 'diary');
  await page.locator('[data-testid="diary-add"]').click();
  const sheet = topModal(page);
  await sheet.locator('.nt-source-btn', { hasText: 'Barcode' }).waitFor();
  return sheet;
}

export function register({ test }) {
  test('scan: Treffer schließt den Scanner, Formular erscheint, Kamera ist frei, UI bedienbar', seed(), async (page) => {
    const sheet = await openScanner(page);
    const started = Date.now();
    await sheet.locator('.nt-source-btn', { hasText: 'Barcode' }).click();

    await page.locator('[data-testid="entry-preview"]').waitFor({ timeout: SCAN_BUDGET_MS });
    const elapsed = Date.now() - started;
    console.log(`      scan: Tippen bis Formular ${elapsed} ms`);
    assert.ok(elapsed < SCAN_BUDGET_MS, `Scan zu langsam: ${elapsed} ms`);

    await eventually(async () => assert.equal(await page.locator('ion-modal.barcode-fullscreen-modal.show-modal').count(), 0, 'Scanner-Modal bleibt sichtbar'));
    assert.equal(await page.locator('ion-backdrop:visible').count() <= 2, true, 'kein zusätzlicher Backdrop');
    assert.equal(await page.evaluate(() => window.__cam.stream.getTracks().every((t) => t.readyState === 'ended')), true, 'Kamera-Tracks nicht gestoppt');
    assert.equal(await page.locator('video').count(), 0, 'Video-Element bleibt im DOM');

    // Nach dem Scan muss alles antippbar sein: Essenszeit wechseln und Menge ändern.
    const dinner = page.locator('.meal-chip[aria-label="Abendessen"]');
    await dinner.click();
    await eventually(async () => assert.equal(await dinner.getAttribute('aria-checked'), 'true'));
    const covered = await page.evaluate(() => {
      const el = document.querySelector('.meal-chip[aria-label="Abendessen"]');
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) !== el;
    });
    assert.equal(covered, false, 'Chip wird von einem Overlay verdeckt');
  });

  test('scan: nicht gefundener Code lässt den Scanner offen und zeigt die Meldung', seed(), async (page) => {
    await page.addInitScript(fakeCameraInit({ code: CODE }));
    await page.route((url) => url.hostname === 'world.openfoodfacts.org', (route) => route.fulfill({
      status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"status":"failure"}',
    }));
    await go(page, 'diary');
    await page.locator('[data-testid="diary-add"]').click();
    await topModal(page).locator('.nt-source-btn', { hasText: 'Barcode' }).click();
    await page.locator('.bc-error').waitFor();
    assert.match(await page.locator('.bc-error').innerText(), /Kein Produkt/);
    const errorFontPx = await page.locator('.bc-error').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(errorFontPx >= 13, `Fehlermeldung zu klein: ${errorFontPx}px`);
    // Schließen gibt die Kamera frei und lässt das Sheet bedienbar zurück.
    await page.locator('.bc-close-fab ion-fab-button').click();
    await eventually(async () => assert.equal(await page.locator('ion-modal.barcode-fullscreen-modal.show-modal').count(), 0));
    await settle(page, 300);
    assert.equal(await page.evaluate(() => window.__cam.stream.getTracks().every((t) => t.readyState === 'ended')), true, 'Kamera-Tracks nicht gestoppt');
    await page.locator('.meal-chip[aria-label="Mittagessen"]').click();
  });
}
