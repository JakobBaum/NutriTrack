// Welle 4: "Essen beschreiben" (Text -> KI-Erkennung gemockt -> Bestätigungsliste -> Tagebuch).
import fs from 'node:fs';
import path from 'node:path';
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { clickToastButton, stableClick, topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_FONT_PX = 16;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const SHOTS_DIR = process.env.W4_SHOTS_DIR ?? '';
const DESCRIPTION = '2 Semmeln mit Schinken';

const wireItem = (name, portionG, per100g, extra = {}) => ({ name, amount: 1, unit: 'Stk', portionG, per100g, ...extra });
const SEMMEL = wireItem('Semmel', 100, { kcal: 280, proteinG: 9, carbsG: 55, fatG: 1.5 }, { amount: 2 });
const SCHINKEN = wireItem('Schinken', 40, { kcal: 110, proteinG: 20, carbsG: 1, fatG: 3 }, { unit: 'Scheibe', amount: 2 });
const UNSINN = wireItem('Unsinn-Brei', 100, { kcal: 5000, proteinG: 1, carbsG: 1, fatG: 1 });
const OK_BODY = { items: [SEMMEL, SCHINKEN] };

/** Der echte Worker bleibt gesperrt: ein lokaler Mock antwortet und merkt sich die Anfragen mit Inhalt. */
async function mockWorker(page, { status = 200, body = OK_BODY, delayMs = 0, abort = false } = {}) {
  const requests = [];
  await page.route('https://*.workers.dev/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const parsed = JSON.parse(req.postData() ?? '{}');
    if (parsed.fn === 'ping') return route.fulfill({ status: 400, headers: CORS, contentType: 'application/json', body: '{"error":"Unbekannte Funktion"}' });
    requests.push(parsed);
    if (abort) return route.abort('failed');
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
  return requests;
}

async function shot(page, name, vp) {
  if (!SHOTS_DIR) return;
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${vp.width}.png`) });
}

async function openDescribe(page) {
  await go(page, 'diary');
  await stableClick(page.locator('[data-testid="diary-add"]'));
  const modal = topModal(page);
  await modal.locator('[data-testid="describe-open"]').click();
  await modal.locator('[data-testid="describe-text"]').waitFor();
  await settle(page, 500);
  return modal;
}

const textInput = (modal) => modal.locator('[data-testid="describe-text"] textarea');
const runButton = (modal) => modal.locator('[data-testid="describe-run"]');

async function typeAndRun(page, modal, text = DESCRIPTION) {
  await textInput(modal).fill(text);
  await settle(page, 200);
  await runButton(modal).click();
}

async function waitForRows(modal, count) {
  await modal.locator('[data-testid="describe-row"]').nth(count - 1).waitFor({ timeout: 8000 });
}

const rowTexts = (modal) => modal.locator('[data-testid="describe-row"]').allInnerTexts();
const sumText = async (modal) => (await modal.locator('[data-testid="describe-sum"]').innerText()).replace(/\s+/g, ' ');
const isDisabled = (locator) => locator.evaluate((el) => el.disabled === true || el.hasAttribute('disabled'));

const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`Seite ${document.documentElement.scrollWidth - vw}px zu breit`);
  const root = document.querySelector('ion-modal.show-modal app-describe-meal') ?? document.body;
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) out.push(`${el.className || el.tagName} ragt heraus (${Math.round(r.right)} > ${vw})`);
  }
  return out;
});

export function register({ test }) {
  test('w4 describe: Glückspfad bis Tagebuch, Menge ändern, Zeile entfernen, Rückgängig', seed(), async (page) => {
    const requests = await mockWorker(page);
    const modal = await openDescribe(page);
    assert.ok(await isDisabled(runButton(modal)), 'Erkennen muss ohne Text gesperrt sein');
    await typeAndRun(page, modal);
    await waitForRows(modal, 2);
    assert.deepEqual(requests.map((r) => r.fn), ['parseMeal']);
    assert.deepEqual(requests[0].payload, { text: DESCRIPTION });
    assert.equal((await rowTexts(modal)).length, 2);
    assert.match((await rowTexts(modal))[0], /KI-Schätzung/);
    assert.match(await sumText(modal), /324\s*kcal.*17\s*g Eiweiß/);

    await modal.locator('[data-testid="describe-amount"]').first().locator('input').fill('200');
    await settle(page, 300);
    assert.match(await sumText(modal), /604\s*kcal.*26\s*g Eiweiß/, 'Menge ändern rechnet neu');

    await modal.locator('[aria-label="Schinken entfernen"]').click();
    await settle(page, 300);
    assert.equal((await rowTexts(modal)).length, 1);
    assert.match(await sumText(modal), /560\s*kcal.*18\s*g Eiweiß/);

    await modal.locator('[data-testid="describe-log"]').click();
    await settle(page, 600);
    const diary = await readStore(page, 'diary');
    assert.equal(diary.length, 1);
    assert.equal(diary[0].label, 'Semmel');
    assert.equal(diary[0].facts.kcal, 560);
    assert.equal(diary[0].facts.proteinG, 18);
    assert.equal(diary[0].amountG, 200);
    assert.equal(diary[0].isEstimate, true);
    await clickToastButton(page, 'Rückgängig');
    assert.equal((await readStore(page, 'diary')).length, 0, 'Rückgängig nimmt den Eintrag zurück');
  });

  test('w4 describe: Eintragen schließt das Sheet ohne Verwerfen-Dialog', seed(), async (page) => {
    await mockWorker(page);
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await waitForRows(modal, 2);
    await modal.locator('[data-testid="describe-log"]').click();
    await settle(page, 900);
    assert.equal(await page.locator('ion-alert, ion-action-sheet', { hasText: 'Verwerfen?' }).count(), 0, 'kein Verwerfen-Dialog nach Eintragen');
    assert.equal(await page.locator('ion-modal.show-modal').count(), 0, 'Sheet muss geschlossen sein');
    assert.equal((await readStore(page, 'diary')).length, 2);
  });

  test('w4 describe: Titel nennt die Essenszeit, X mit Text fragt genau einmal nach', seed(), async (page) => {
    await mockWorker(page);
    await go(page, 'diary');
    assert.equal(await page.locator('.meal__add').count(), 0, '"+" je Mahlzeit nur bei nicht leeren Mahlzeiten');
    await stableClick(page.locator('[data-testid="diary-add"]'));
    const modal = topModal(page);
    assert.match(await modal.locator('.nt-sheet-header__title').innerText(), /^In (Frühstück|Mittagessen|Abendessen|Snacks) eintragen$/);
    await modal.locator('[data-testid="describe-open"]').click();
    await textInput(modal).fill(DESCRIPTION);
    await modal.locator('[data-testid="add-close"]').last().click();
    const dialog = page.locator('ion-action-sheet', { hasText: 'Verwerfen?' });
    await dialog.waitFor({ timeout: 3000 });
    await dialog.getByRole('button', { name: 'Verwerfen' }).click();
    // Action-Sheet und Modal blenden noch aus: erst auf das geschlossene Sheet warten, dann auf die zweite Rückfrage prüfen.
    await eventually(async () => assert.equal(await page.locator('ion-modal.show-modal').count(), 0, 'Sheet geschlossen'));
    assert.equal(await page.locator('ion-action-sheet', { hasText: 'Verwerfen?' }).count(), 0, 'keine zweite Rückfrage');
  });

  test('w4 describe: mehrere Zeilen ergeben je einen Eintrag', seed(), async (page) => {
    await mockWorker(page);
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await waitForRows(modal, 2);
    await modal.locator('[data-testid="describe-log"]').click();
    await settle(page, 600);
    const diary = await readStore(page, 'diary');
    assert.deepEqual(diary.map((e) => e.label).sort(), ['Schinken', 'Semmel']);
    const schinken = diary.find((e) => e.label === 'Schinken');
    assert.equal(schinken.facts.kcal, 44);
    assert.equal(schinken.facts.proteinG, 8);
  });

  test('w4 describe: unplausible Zeile wird verworfen und erscheint nicht', seed(), async (page) => {
    await mockWorker(page, { body: { items: [SEMMEL, UNSINN] } });
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await waitForRows(modal, 1);
    assert.equal((await rowTexts(modal)).length, 1);
    assert.ok(!(await modal.innerText()).includes('Unsinn-Brei'));
    assert.match(await modal.locator('[data-testid="describe-dropped"]').innerText(), /unplausibel/);
  });

  test('w4 describe: Zeile mit abweichenden kcal zeigt "Werte prüfen"', seed(), async (page) => {
    await mockWorker(page, { body: { items: [wireItem('Rätsel-Müsli', 50, { kcal: 600, proteinG: 5, carbsG: 20, fatG: 5 })] } });
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await waitForRows(modal, 1);
    assert.match(await modal.locator('[data-testid="describe-doubt"]').innerText(), /Werte prüfen/);
  });

  test('w4 describe: alles verworfen zeigt "Nichts erkannt" mit Weg zur manuellen Eingabe', seed(), async (page) => {
    await mockWorker(page, { body: { items: [UNSINN] } });
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await modal.locator('[data-testid="describe-empty"]').waitFor({ timeout: 8000 });
    assert.match(await modal.locator('[data-testid="describe-empty"]').innerText(), /Nichts erkannt\. Beschreib es genauer oder trag es von Hand ein\./);
    await modal.locator('[data-testid="describe-manual"]').click();
    await settle(page, 500);
    await modal.locator('ion-input').first().waitFor();
    assert.equal(await modal.locator('[data-testid="describe-text"]').count(), 0, 'manuelles Formular ersetzt die Beschreibung');
  });

  test('w4 describe: Tageslimit 429 zeigt eine verständliche Meldung', seed(), async (page) => {
    await mockWorker(page, { status: 429, body: { error: 'limit' } });
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await modal.locator('[data-testid="describe-error"]').waitFor({ timeout: 8000 });
    assert.match(await modal.locator('[data-testid="describe-error"]').innerText(), /Zu viele Anfragen/);
    assert.equal(await isDisabled(runButton(modal)), false, 'neuer Versuch bleibt möglich');
  });

  test('w4 describe: offline zeigt die Offline-Meldung', seed(), async (page) => {
    await mockWorker(page, { abort: true });
    const modal = await openDescribe(page);
    await textInput(modal).fill(DESCRIPTION);
    await settle(page, 200);
    await page.context().setOffline(true);
    await runButton(modal).click();
    await modal.locator('[data-testid="describe-error"]').waitFor({ timeout: 8000 });
    assert.match(await modal.locator('[data-testid="describe-error"]').innerText(), /Keine Internetverbindung/);
    await page.context().setOffline(false);
  });

  test('w4 describe: ohne Zustimmung erscheint der Dialog und nichts wird gesendet', seed({ consent: null }), async (page) => {
    const requests = await mockWorker(page);
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await page.locator('[data-testid="consent-dialog"]').waitFor();
    assert.deepEqual(requests, [], 'ohne Zustimmung darf keine Anfrage hinausgehen');
    await settle(page, 300);
    await page.locator('[data-testid="consent-decline"]').click();
    await modal.locator('[data-testid="describe-error"]').waitFor({ timeout: 8000 });
  });

  test('w4 describe: Doppeltipp sendet einen Aufruf, Abbrechen verwirft die Antwort', seed(), async (page) => {
    const requests = await mockWorker(page, { delayMs: 1500 });
    const modal = await openDescribe(page);
    await typeAndRun(page, modal);
    await runButton(modal).click({ force: true }).catch(() => undefined);
    await modal.locator('[data-testid="describe-loading"]').waitFor();
    await modal.locator('[data-testid="describe-cancel"]').click();
    await settle(page, 2200);
    assert.equal(requests.length, 1, 'genau ein Aufruf');
    assert.equal(await modal.locator('[data-testid="describe-row"]').count(), 0, 'veraltete Antwort wird verworfen');
    assert.equal(await modal.locator('[data-testid="describe-loading"]').count(), 0);
  });

  test('w4 describe: Zähler, Sperre bei zu langem Text, Schriftgröße im Feld', seed(), async (page) => {
    const modal = await openDescribe(page);
    await textInput(modal).fill('a'.repeat(501));
    await settle(page, 200);
    assert.match(await modal.locator('[data-testid="describe-counter"]').innerText(), /501 \/ 500/);
    assert.ok(await isDisabled(runButton(modal)), 'zu langer Text sperrt Erkennen');
    const fontPx = await textInput(modal).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(fontPx >= MIN_FONT_PX, `Schrift ${fontPx}px < 16px`);
    assert.match(await modal.innerText(), /Mikrofon-Taste der Tastatur/);
  });

  for (const vp of VIEWPORTS) {
    test(`w4 describe ${vp.width}px: kein Überlauf in Eingabe, Laden, Liste und Fehler; Tippziele >= var(--nt-touch)`, seed(), async (page) => {
      await page.setViewportSize(vp);
      await mockWorker(page, { delayMs: 800 });
      const modal = await openDescribe(page);
      assert.deepEqual(await overflow(page), []);
      await shot(page, 'eingabe', vp);

      await typeAndRun(page, modal, 'a'.repeat(120));
      await modal.locator('[data-testid="describe-loading"]').waitFor();
      assert.deepEqual(await overflow(page), []);
      await shot(page, 'laden', vp);

      await waitForRows(modal, 2);
      await settle(page, 400);
      assert.deepEqual(await overflow(page), []);
      const sizes = await modal.locator('[data-testid="describe-remove"], app-amount-row button, [data-testid="describe-log"]').evaluateAll(
        (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)),
      );
      const minTouch = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nt-touch')));
      assert.ok(minTouch >= 40, `--nt-touch unerwartet: ${minTouch}`);
      assert.ok(sizes.every((h) => h >= minTouch), `Tippziele unter var(--nt-touch) (${minTouch}): ${sizes}`);
      const footer = await modal.locator('[data-testid="describe-log"]').boundingBox();
      assert.ok(footer && footer.y + footer.height <= vp.height, 'Eintragen liegt nicht im sichtbaren Bereich');
      await shot(page, 'liste', vp);

      await page.unroute('https://*.workers.dev/**');
      await mockWorker(page, { status: 429, body: { error: 'limit' } });
      await modal.locator('[data-testid="describe-edit-text"]').click();
      await runButton(modal).click();
      await modal.locator('[data-testid="describe-error"]').waitFor({ timeout: 8000 });
      assert.deepEqual(await overflow(page), []);
      await shot(page, 'fehler', vp);
    });
  }
}
