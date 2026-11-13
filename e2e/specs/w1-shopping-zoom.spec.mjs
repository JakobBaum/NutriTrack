// Welle 1: Zoom (Felder >= 16 px), Einkauf-Sheet mit Tastatur, Preis-Tag nicht abgeschnitten, Nutri-Score auf Meta-Hoehe, Toasts.
import { assert, go, settle } from '../lib/harness.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const NARROW_VIEWPORTS = [{ width: 320, height: 568 }, { width: 375, height: 667 }];
/** iOS-Tastatur 216 + Vorschlagsleiste 44 + "Fertig"-Leiste 44. */
const KEYBOARD_PX = 304;
/** Der Button darf knapp in die Leiste ragen; Felder muessen frei bleiben. */
const SUBMIT_RESERVE_PX = 260;
const MAX_SCORE_OFFSET_PX = 2;
const MAX_UNDO_TOAST_MS = 3500;
const ISO = new Date().toISOString();

const LONG_LIST = {
  id: 's-long', dishes: 2, persons: 2, generatedAt: ISO, days: 3, store: 'Spar',
  items: [
    { name: 'Vollkorn-Dinkelspaghetti mit extra langem Namen Bio', amount: 1250, unit: 'g', checked: false, estPrice: 12.5 },
    { name: 'Hafermilch ohne Zucker', amount: 1250, unit: 'ml', checked: false, userPrice: 129.99 },
    { name: 'Zwiebeln', amount: 3, unit: 'Stk', checked: false, estPrice: 0.9 },
    { name: 'Rote Linsen', amount: 400, unit: 'g', checked: false, estPrice: 2.3 },
  ],
};
const SHORT_LIST = {
  id: 's1', dishes: 2, persons: 2, generatedAt: ISO, days: 3, store: 'Spar',
  items: [{ name: 'Rote Linsen', amount: 400, unit: 'g', checked: false, estPrice: 2.3 }],
};
const OFF_HITS = {
  hits: [{
    code: '111', product_name: 'Joghurt Bio Natur extra cremig mit langem Namen', brands: 'Alpro', quantity: '500 g',
    nutriscore_grade: 'b', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 4 },
  }],
};

/** Boxen der Add-Sheet-Elemente (bottom, Viewport-Hoehe). */
const measureAddSheet = (page) => page.evaluate(() => {
  const bottom = (sel) => document.querySelector(`ion-modal.add-sheet ${sel}`)?.getBoundingClientRect().bottom ?? null;
  return {
    inner: window.innerHeight,
    name: bottom('.add-name'), amount: bottom('.amount-unit'), price: bottom('.add-price'), submit: bottom('.add-submit'),
  };
});

/** Preis-Tags gegen ihre Zeile und alle Vorfahren (auch ueber Shadow-Grenzen) mit overflow != visible pruefen. */
const measureBadges = (page) => page.evaluate(() => {
  const parentOf = (n) => n.parentElement ?? (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
  const problems = [];
  const badges = [...document.querySelectorAll('ion-router-outlet .ion-page:not(.ion-page-hidden) .est-badge')];
  for (const badge of badges) {
    const b = badge.getBoundingClientRect();
    const row = badge.closest('ion-item');
    const rr = row.getBoundingClientRect();
    const label = badge.closest('.check-row__text')?.querySelector('.check-row__name')?.textContent?.trim().slice(0, 20);
    if (b.right > rr.right + 0.5) problems.push(`${label}: Tag ragt ${Math.round(b.right - rr.right)}px aus der Zeile`);
    if (b.bottom > rr.bottom + 0.5) problems.push(`${label}: Tag unter der Zeile`);
    for (let el = parentOf(badge); el && el !== document.body; el = parentOf(el)) {
      const ov = getComputedStyle(el).overflowX;
      if (ov === 'visible') continue;
      const r = el.getBoundingClientRect();
      if (b.right > r.right + 0.5 || b.left < r.left - 0.5 || b.bottom > r.bottom + 0.5) {
        problems.push(`${label}: Tag von <${el.tagName.toLowerCase()}.${el.className}> abgeschnitten`);
        break;
      }
    }
  }
  for (const qty of document.querySelectorAll('ion-router-outlet .ion-page:not(.ion-page-hidden) .qty')) {
    if (qty.scrollWidth > qty.clientWidth) problems.push(`.qty scrollWidth ${qty.scrollWidth} > clientWidth ${qty.clientWidth}`);
  }
  return { count: badges.length, problems };
});

export function register({ test }) {
  for (const vp of VIEWPORTS) {
    test(`w1 einkauf: Add-Sheet liegt ueber der Tastatur bei ${vp.width}x${vp.height}`, seed({ shopping: SHORT_LIST }), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'shopping');
      await page.locator('ion-fab-button').click();
      await page.locator('ion-modal.add-sheet').waitFor({ state: 'visible' });
      await settle(page, 1200);
      const m = await measureAddSheet(page);
      const limit = m.inner - KEYBOARD_PX;
      for (const key of ['name', 'amount', 'price']) {
        assert.ok(m[key] !== null && m[key] <= limit, `${key} bottom ${m[key]} > ${limit} (Tastatur verdeckt)`);
      }
      assert.ok(m.submit !== null && m.submit <= m.inner - SUBMIT_RESERVE_PX, `Button bottom ${m.submit} > ${m.inner - SUBMIT_RESERVE_PX}`);
    });
  }

  for (const vp of NARROW_VIEWPORTS) {
    test(`w1 einkauf: Preis-Tag nicht abgeschnitten bei ${vp.width}`, seed({ shopping: LONG_LIST }), async (page) => {
      await page.setViewportSize({ width: vp.width, height: 667 });
      await go(page, 'shopping');
      await settle(page, 600);
      const { count, problems } = await measureBadges(page);
      assert.ok(count >= 3, `erwartet >= 3 Tags, gefunden ${count}`);
      assert.deepEqual(problems, [], problems.join('; '));
    });

    test(`w1 suche: Nutri-Score auf Hoehe der Naehrwert-Zeile bei ${vp.width}`, seed({}), async (page) => {
      await page.setViewportSize({ width: vp.width, height: 667 });
      await page.route((url) => url.pathname.endsWith('/off-search'), (route) => route.fulfill({
        status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(OFF_HITS),
      }));
      await go(page, 'diary');
      await page.locator('.page-head__add').click();
      const modal = page.locator('ion-modal.show-modal').last();
      await modal.locator('ion-searchbar input').first().fill('joghurt');
      await modal.locator('nt-food-row .score').first().waitFor({ timeout: 5000 });
      await settle(page, 2000);
      const m = await page.evaluate(() => {
        const row = document.querySelector('ion-modal.show-modal nt-food-row');
        const score = row.querySelector('.score').getBoundingClientRect();
        const meta = row.querySelector('.meta').getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        return {
          offset: Math.abs((score.top + score.bottom) / 2 - (meta.top + meta.bottom) / 2),
          scoreRight: score.right, scoreLeft: score.left, rowRight: rr.right, rowLeft: rr.left, metaRight: meta.right,
        };
      });
      assert.ok(m.offset <= MAX_SCORE_OFFSET_PX, `Marke ${m.offset.toFixed(1)}px neben der Meta-Mitte`);
      assert.ok(m.scoreRight <= m.rowRight + 0.5 && m.scoreLeft >= m.rowLeft, 'Marke ragt aus der Zeile');
      assert.ok(m.metaRight <= m.scoreLeft + 0.5, 'Marke ueberdeckt den Text');
    });
  }

  test('w1 einkauf: Toasts wischbar und kurz', seed({ shopping: SHORT_LIST }), async (page) => {
    await go(page, 'shopping');
    await page.locator('.check-row__name').first().waitFor();
    const toasts = await page.evaluate(() => [...document.querySelectorAll('ion-router-outlet .ion-page:not(.ion-page-hidden) ion-toast')]
      .map((t) => ({ swipe: t.swipeGesture, duration: t.duration, isUndo: Array.isArray(t.buttons) && t.buttons.some((b) => b.role === 'undo') })));
    assert.ok(toasts.length >= 3, `erwartet 3 Toasts, gefunden ${toasts.length}`);
    for (const t of toasts) assert.equal(t.swipe, 'vertical', 'swipeGesture');
    // Nur Rückgängig-Hinweise sind kurz; der Hinweis „Zur Liste“ bleibt bewusst länger stehen.
    const undo = toasts.filter((x) => x.isUndo);
    assert.ok(undo.length >= 1, 'kein Rückgängig-Toast gefunden');
    for (const t of undo) assert.ok(t.duration <= MAX_UNDO_TOAST_MS, `Toast ${t.duration} ms > ${MAX_UNDO_TOAST_MS}`);
  });
}
