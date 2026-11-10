// Screenshots + Messung fuer die UI-Groesse: node e2e/shots-size.mjs <vorher|nachher>
// (E2E_BASE_URL, NT_PLAYWRIGHT_DIR wie bei run.mjs). Alle 5 Tabs bei 375x667 und 320x568.
import path from 'node:path';
import { ARTIFACTS, go, launchBrowser, newPage, settle } from './lib/harness.mjs';
import { DIARY_NORMAL, WEIGHT_HISTORY, seed } from './lib/fixtures.mjs';

const label = process.argv[2] ?? 'vorher';
const browser = await launchBrowser();
const sizes = [[375, 667], [320, 568]];
const routes = ['dashboard', 'diary', 'recipes', 'shopping', 'settings'];

for (const [w, h] of sizes) {
  for (const route of routes) {
    const { ctx, page } = await newPage(browser, seed({ diary: DIARY_NORMAL, weight: WEIGHT_HISTORY }));
    await page.setViewportSize({ width: w, height: h });
    await go(page, route);
    await settle(page, 600);
    await page.screenshot({ path: path.join(ARTIFACTS, `${label}-${route}-${w}.png`) });
    const m = await page.evaluate(() => {
      const bar = document.querySelector('ion-tab-bar')?.getBoundingClientRect();
      const small = [...document.querySelectorAll('ion-button, button, ion-tab-button, ion-segment-button, a')]
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.height < 40).length;
      const h1 = document.querySelector('.nt-large-title');
      return {
        tabbarH: bar ? Math.round(bar.height) : null,
        titleFs: h1 ? getComputedStyle(h1).fontSize : null,
        bodyFs: getComputedStyle(document.body).fontSize,
        scrollW: document.documentElement.scrollWidth,
        under40: small,
      };
    });
    console.log(label, route, w, JSON.stringify(m));
    await ctx.close();
  }
}
await browser.close();
