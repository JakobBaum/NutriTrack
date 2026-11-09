// Screenshots für Welle D/E: node e2e/shots-d.mjs  (E2E_BASE_URL, NT_PLAYWRIGHT_DIR wie bei run.mjs)
// Zusätzlich je Seite ein Lauf mit großer Schrift (html font-size 150 %), um Dynamic Type zu simulieren.
import path from 'node:path';
import { ARTIFACTS, go, launchBrowser, newPage, settle } from './lib/harness.mjs';
import { DIARY_NORMAL, WEIGHT_HISTORY, seed } from './lib/fixtures.mjs';

const browser = await launchBrowser();
const sizes = [[375, 812], [320, 700]];
const pages = ['dashboard', 'diary', 'recipes', 'shopping', 'settings'];

async function shot(route, [w, h], big) {
  const { ctx, page } = await newPage(browser, seed({ diary: DIARY_NORMAL, weight: WEIGHT_HISTORY }));
  await page.setViewportSize({ width: w, height: h });
  await go(page, route);
  if (big) await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
  await settle(page, 600);
  await page.screenshot({ path: path.join(ARTIFACTS, `d-${route}${big ? '-gross' : ''}-${w}.png`), fullPage: false });
  await ctx.close();
}

for (const size of sizes) for (const route of pages) for (const big of [false, true]) await shot(route, size, big);
await browser.close();
console.log('fertig');
