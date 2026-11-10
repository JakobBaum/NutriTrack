// KI-Antworten auf schmalen Phones (320 px = iPhone SE 1, 375 px): kein Überlauf, Schrift >= 13 px, Fortschritt sichtbar.
import { assert, eventually, go, settle } from '../lib/harness.mjs';
import { seed } from '../lib/fixtures.mjs';

const MIN_FONT_PX = 13;
const NARROW_VIEWPORTS = [{ width: 320, height: 568 }, { width: 375, height: 667 }];
const AI_DELAY_MS = 700;
const LONG = 'Ein sehr langer Vorschlag mit ein_wirklich_extrem_langes_Wort_ohne_Leerzeichen_Cheeseburger_mit_Extra_Sosse und einer ausführlichen Begründung, die mehrfach umbrechen muss.';

const REPLIES = {
  suggestFastfood: [{
    restaurant: 'McDonalds', itemName: `Chicken Burger Deluxe ${LONG.slice(0, 40)}`,
    facts: { kcal: 450, proteinG: 28, carbsG: 40, fatG: 18, basis: 'perPortion' }, rationale: LONG, estPrice: 5.9,
  }],
  recognizeLabel: {
    name: LONG.slice(0, 60),
    facts: { kcal: 440, proteinG: 12, carbsG: 55, fatG: 18, fiberG: null, sugarG: 6.5, saltG: 1.2, basis: 'per100g', portionG: null },
  },
};

/** Der echte KI-Worker bleibt gesperrt; hier antwortet ein lokaler Mock mit langen Texten und kurzer Verzögerung. */
async function mockAi(page) {
  await page.route('https://*.workers.dev/**', async (route) => {
    let fn = '';
    try { fn = JSON.parse(route.request().postData() ?? '{}').fn; } catch { fn = ''; }
    await new Promise((resolve) => setTimeout(resolve, AI_DELAY_MS));
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(REPLIES[fn] ?? {}),
    });
  });
}

/** Meldet Seitenüberlauf, zu kleine Schrift und abgeschnittene Texte im obersten Modal. */
function audit(page) {
  return page.evaluate((minFont) => {
    const root = document.querySelector('ion-modal.show-modal') ?? document.body;
    const problems = [];
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    if (overflow > 0) problems.push(`Seite ${overflow}px zu breit`);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const font = parseFloat(getComputedStyle(el).fontSize);
      if (font < minFont) problems.push(`${font}px "${text.slice(0, 30)}"`);
      if (rect.right > window.innerWidth + 1) problems.push(`ragt heraus: "${text.slice(0, 30)}"`);
    }
    return problems;
  }, MIN_FONT_PX);
}

async function openFastfood(page) {
  await go(page, 'diary');
  await page.locator('.ff-btn').click();
  await page.locator('ion-modal.show-modal').last().waitFor();
  await settle(page, 500);
  await page.getByRole('button', { name: /Vorschläge holen/ }).click({ force: true });
  await page.locator('.ff-card').first().waitFor({ timeout: 8000 });
  await settle(page, 600);
}

async function scanLabel(page) {
  await go(page, 'diary');
  await page.locator('.page-head__add').click();
  await page.locator('.nt-source-btn', { hasText: 'Etikett' }).waitFor();
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 800;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 800);
    g.fillStyle = '#000'; g.font = '40px Arial'; g.fillText('Energie 440 kcal', 40, 100);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'etikett.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
}

export function register({ test }) {
  for (const viewport of NARROW_VIEWPORTS) {
    test(`ki-lesbar ${viewport.width}px: Fastfood-Vorschlag bricht um, ist >= 13 px und liegt im Blick`, seed(), async (page) => {
      await page.setViewportSize(viewport);
      await mockAi(page);
      await openFastfood(page);

      const problems = await audit(page);
      assert.deepEqual(problems, [], problems.join('; '));
      const inView = await page.locator('.ff-card').first().evaluate((el) => el.getBoundingClientRect().top < window.innerHeight);
      assert.ok(inView, 'Vorschlag nach dem Laden nicht sichtbar (Antwort bleibt unter dem Formular)');
    });

    test(`ki-lesbar ${viewport.width}px: Etikett zeigt Fortschritt, dann lesbares Ergebnis`, seed(), async (page) => {
      await page.setViewportSize(viewport);
      await mockAi(page);
      await scanLabel(page);

      await eventually(async () => assert.ok(await page.locator('.nt-source-status').count() > 0, 'kein Fortschrittstext'), 4000, 50);
      const status = await page.locator('.nt-source-status').first().innerText();
      assert.match(status, /Foto|KI/);
      await page.locator('[data-testid="entry-preview"]').waitFor({ timeout: 8000 });
      await settle(page, 400);
      assert.equal(await page.locator('.nt-source-status').count(), 0, 'Fortschritt bleibt nach dem Ergebnis stehen');
      const problems = await audit(page);
      assert.deepEqual(problems, [], problems.join('; '));
    });
  }
}
