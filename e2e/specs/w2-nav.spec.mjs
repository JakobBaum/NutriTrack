// Welle 2: Navigation nur mit Symbolen, Reihenfolge Heute, Rezepte, Tagebuch, Einkauf, Profil.
import { assert, go, settle } from '../lib/harness.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_TAP_PX = 44;
const EXPECTED = [
  { tab: 'dashboard', label: 'Heute', icon: 'home-outline' },
  { tab: 'recipes', label: 'Rezepte und Mahlzeiten', icon: 'book-outline' },
  { tab: 'diary', label: 'Tagebuch', icon: 'calendar-outline' },
  { tab: 'shopping', label: 'Einkauf', icon: 'basket-outline' },
  { tab: 'settings', label: 'Profil', icon: 'person-circle-outline' },
];

const readTabs = (page) => page.evaluate(() => [...document.querySelectorAll('ion-tab-bar ion-tab-button')].map((button) => {
  const box = button.getBoundingClientRect();
  return {
    tab: button.getAttribute('tab'),
    // Ionic verschiebt aria-label vom Host auf den inneren Button.
    label: button.getAttribute('aria-label') ?? button.shadowRoot?.querySelector('[aria-label]')?.getAttribute('aria-label') ?? null,
    icon: button.querySelector('ion-icon')?.getAttribute('name') ?? null,
    text: button.textContent.trim(),
    width: box.width,
    height: box.height,
  };
}));

export function register({ test }) {
  for (const vp of VIEWPORTS) {
    test(`w2 nav: nur Symbole in neuer Reihenfolge bei ${vp.width}`, seed({}), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'dashboard');
      await settle(page, 400);
      const tabs = await readTabs(page);
      assert.deepEqual(tabs.map(({ tab, label, icon }) => ({ tab, label, icon })), EXPECTED);
      for (const t of tabs) {
        assert.equal(t.text, '', `${t.tab}: sichtbarer Text "${t.text}"`);
        assert.ok(t.width >= MIN_TAP_PX && t.height >= MIN_TAP_PX, `${t.tab}: Tippfläche ${Math.round(t.width)}x${Math.round(t.height)}`);
      }
    });
  }

  test('w2 nav: Tipp auf ein Symbol wechselt den Tab', seed({}), async (page) => {
    await go(page, 'dashboard');
    await page.locator('ion-tab-button[tab="diary"]').click();
    await page.waitForURL(/\/diary/);
    await page.locator('ion-tab-button[tab="diary"].tab-selected').waitFor({ timeout: 3000 });
  });
}
