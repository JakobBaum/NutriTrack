// Screenshots für Welle B: node e2e/shots.mjs  (E2E_BASE_URL, NT_PLAYWRIGHT_DIR wie bei run.mjs)
import path from 'node:path';
import { ARTIFACTS, go, launchBrowser, newPage, settle } from './lib/harness.mjs';
import { DIARY_NORMAL, WEIGHT_HISTORY, daysAgoISO, entryOn, facts, seed } from './lib/fixtures.mjs';

const browser = await launchBrowser();
const sizes = [[375, 812], [320, 700]];
const week = [1, 2, 3, 4].map((ago) => entryOn(daysAgoISO(ago), `w${ago}`, 'Skyr', facts(900, 90, 80, 20)));
const big = [entryOn(daysAgoISO(0), 'big', 'Festmahl', facts(2450, 120, 300, 90))];

async function shot(name, data, [w, h], act) {
  const { ctx, page } = await newPage(browser, data);
  await page.setViewportSize({ width: w, height: h });
  await go(page, 'dashboard');
  if (act) await act(page);
  await settle(page, 600);
  await page.screenshot({ path: path.join(ARTIFACTS, `${name}-${w}.png`), fullPage: false });
  await ctx.close();
}

for (const size of sizes) {
  await shot('heute-leer', seed({ weight: WEIGHT_HISTORY }), size);
  await shot('heute-gefuellt', seed({ diary: [...DIARY_NORMAL, ...week], weight: WEIGHT_HISTORY }), size, (p) => p.evaluate(() => document.querySelector('ion-content')?.scrollTo(0, 400)));
  await shot('heute-gefuellt-oben', seed({ diary: [...DIARY_NORMAL, ...week], weight: WEIGHT_HISTORY }), size);
  await shot('heute-4stellig', seed({ diary: big }), size);
  await shot('add-sheet', seed({ diary: DIARY_NORMAL }), size, async (p) => {
    await p.locator('ion-fab.nt-fab ion-fab-button').click();
    await p.locator('ion-modal.show-modal').last().waitFor();
    await settle(p, 800);
  });
}
await browser.close();
console.log('fertig');
