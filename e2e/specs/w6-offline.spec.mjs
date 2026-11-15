// Welle 6 (Befund 23): globaler, ruhiger Offline-Hinweis oben auf allen Tabs.
import fs from 'node:fs';
import path from 'node:path';
import { assert, go, settle } from '../lib/harness.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const TABS = ['dashboard', 'diary', 'recipes', 'settings'];
const NOTICE = '[data-testid="offline-banner"]';
const SHOT_DIR = process.env.W6_SHOTS_DIR ?? '';

const shot = async (page, name) => {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
};

const noticeBox = (page) => page.locator(NOTICE).boundingBox();

/** Kopfzeile und runder Knopf müssen vollständig unter dem Hinweis liegen und im Fenster bleiben. */
const coveredByNotice = (page) => page.evaluate((sel) => {
  const notice = document.querySelector(sel)?.getBoundingClientRect();
  if (!notice) return ['kein Hinweis'];
  const out = [];
  const page = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)');
  for (const el of page?.querySelectorAll('ion-header, .nt-page-header, ion-title, ion-fab-button') ?? []) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.top < notice.bottom - 1) out.push(`${el.tagName} beginnt bei ${Math.round(r.top)} unter dem Hinweis (${Math.round(notice.bottom)})`);
    if (r.width > 0 && r.bottom > window.innerHeight + 1) out.push(`${el.tagName} ragt unten heraus`);
  }
  if (document.documentElement.scrollWidth > window.innerWidth) out.push('horizontaler Überlauf');
  return out;
}, NOTICE);

export function register({ test }) {
  test('w6 offline: Hinweis erscheint offline und verschwindet online, aria-live polite', seed(), async (page) => {
    await go(page, 'dashboard');
    assert.equal(await page.locator(NOTICE).count(), 0, 'online: kein Hinweis');
    await page.context().setOffline(true);
    await page.locator(NOTICE).waitFor({ timeout: 4000 });
    assert.equal(await page.locator(NOTICE).getAttribute('aria-live'), 'polite');
    assert.match(await page.locator(NOTICE).innerText(), /Offline\. KI und Online-Suche sind gerade nicht verfügbar, dein Tagebuch funktioniert weiter\./);
    await page.context().setOffline(false);
    await page.locator(NOTICE).waitFor({ state: 'detached', timeout: 4000 });
    const offset = await page.evaluate(() => document.documentElement.style.getPropertyValue('--nt-offline-offset'));
    assert.equal(offset, '', 'Maß wird aufgeräumt');
  });

  for (const vp of VIEWPORTS) {
    test(`w6 offline ${vp.width}px: Hinweis auf allen Tabs, verdeckt weder Kopfzeile noch Hinzufügen-Knopf`, seed(), async (page) => {
      await page.setViewportSize(vp);
      for (const tab of TABS) {
        await go(page, tab);
        await page.context().setOffline(true);
        await page.locator(NOTICE).waitFor({ timeout: 4000 });
        await settle(page, 500);
        const box = await noticeBox(page);
        assert.ok(box && box.y >= 0 && box.x >= 0 && box.x + box.width <= vp.width + 1, `${tab}: Hinweis außerhalb (${JSON.stringify(box)})`);
        assert.deepEqual(await coveredByNotice(page), [], `${tab}: etwas wird verdeckt`);
        if (tab === 'diary') await shot(page, `offline-${vp.width}`);
        await page.context().setOffline(false);
        await page.locator(NOTICE).waitFor({ state: 'detached', timeout: 4000 });
      }
    });
  }
}
