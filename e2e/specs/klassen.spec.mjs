// Fehlerklassen-Pruefung (Teil 2): Doppel-Tipp auf Overlays, Import -> Rezept-Sheet ohne Fokus-Falle.
import { assert, go, settle } from '../lib/harness.mjs';
import { seed } from '../lib/fixtures.mjs';

const openModals = (page) => page.locator('ion-modal.show-modal').count();

export function register({ test }) {
  test('klassen: Doppel-Tipp auf "Rezepte online suchen" oeffnet genau ein Sheet', seed(), async (page) => {
    await go(page, 'recipes');
    await page.locator('[data-testid="online-search-btn"]').dblclick();
    await settle(page, 1500);
    assert.equal(await openModals(page), 1, 'mehrere Sheets uebereinander');
  });

  test('klassen: Text-Import oeffnet das Rezept-Sheet, genau ein Overlay, Feld bedienbar', seed(), async (page) => {
    await go(page, 'recipes');
    await page.locator('button.page-head__import[aria-label^="Rezept importieren"]').click();
    const modal = page.locator('ion-modal.show-modal').last();
    await modal.locator('textarea').fill('Pfannkuchen\n250 g Mehl\n2 Eier\n300 ml Milch\nAlles verruehren und braten.');
    await modal.locator('ion-button.save-btn').click();
    await settle(page, 2000);
    assert.equal(await openModals(page), 1, 'Import-Sheet oder Rezept-Sheet haengt');
    await page.locator('ion-modal.show-modal input').first().click({ timeout: 2000 });
  });
}
