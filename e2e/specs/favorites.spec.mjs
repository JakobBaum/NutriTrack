// Favoriten: im Bearbeiten-Dialog merken, im Eintragen-Sheet mit einem Tipp eintragen.
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { DIARY_NORMAL, facts, seed } from '../lib/fixtures.mjs';

const SKYR = { id: 'f1', label: 'Skyr', ref: { kind: 'manual' }, facts: facts(100, 17, 4, 0.2, 0, 4), createdAt: new Date().toISOString() };

export function register({ test }) {
  test('favorites: Stern im Bearbeiten-Dialog speichert Favorit', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    await page.locator('ion-item-sliding ion-item', { has: page.locator('h3:text-is("Linsencurry")') }).click();
    const modal = topModal(page);
    await modal.locator('[data-testid="edit-favorite"]').click();
    await settle(page, 400);
    const favs = await readStore(page, 'favorites');
    assert.equal(favs.length, 1);
    assert.equal(favs[0].label, 'Linsencurry');
    await eventually(async () => assert.match(await modal.locator('[data-testid="edit-favorite"]').innerText(), /Favorit entfernen/));
  });

  test('favorites: Favorit im Eintragen-Sheet trägt mit einem Tipp ein', seed({ favorites: [SKYR] }), async (page) => {
    await go(page, 'diary');
    await page.locator('[data-testid="diary-add"]').click();
    const modal = topModal(page);
    await modal.locator('[data-testid="favorites-list"]').waitFor();
    await modal.locator('[data-testid="favorite-add"]').click();
    await settle(page, 500);
    const diary = await readStore(page, 'diary');
    assert.ok(diary.some((e) => e.label === 'Skyr'), 'Favorit wurde nicht eingetragen');
  });
}
