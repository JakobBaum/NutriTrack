// Screenshots Profil (Welle C): node e2e/shots-profil.mjs  (E2E_BASE_URL, NT_PLAYWRIGHT_DIR wie bei run.mjs)
import path from 'node:path';
import { ARTIFACTS, go, launchBrowser, newPage, settle } from './lib/harness.mjs';
import { seed } from './lib/fixtures.mjs';
import { topModal } from './lib/ionic.mjs';

const browser = await launchBrowser();
for (const [w, h] of [[375, 812], [320, 700]]) {
  for (const mode of ['auto', 'manuell']) {
    const { ctx, page } = await newPage(browser, seed({}));
    await page.setViewportSize({ width: w, height: h });
    await go(page, 'settings');
    await page.locator('[data-testid="open-profile"]').click();
    const modal = topModal(page);
    await modal.locator('[data-testid="profile-preview"]').waitFor();
    if (mode === 'manuell') {
      await modal.locator('[data-testid="target-manual"]').click();
      await modal.locator('[data-testid="manual-kcal"] input').waitFor();
      await modal.locator('[data-testid="manual-kcal"] input').fill('300');
      await modal.locator('[data-testid="manual-kcal"] input').press('Tab');
      await modal.locator('[data-testid="manual-kcal-error"]').scrollIntoViewIfNeeded();
    }
    await settle(page, 800);
    await page.screenshot({ path: path.join(ARTIFACTS, `profil-${mode}-${w}.png`) });
    await ctx.close();
  }
}
await browser.close();
console.log('fertig');
