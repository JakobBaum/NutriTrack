// Welle 1: Mahlzeit-Sheet schliesst nach "Weiter bearbeiten" erneut per X; Rueckgaengig-Toast ist kurz und wegwischbar.
import { assert, eventually, go, settle } from '../lib/harness.mjs';
import { topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const MAX_UNDO_TOAST_MS = 4000;
const STAMP = new Date().toISOString();
const MEAL = { id: 'm-1', name: 'Frühstück Standard', entries: [{ label: 'Haferflocken', facts: { kcal: 370, proteinG: 13, carbsG: 59, fatG: 7, basis: 'perPortion' }, ref: { kind: 'manual' } }], createdAt: STAMP, updatedAt: STAMP };

const openCreate = async (page) => {
  await go(page, 'recipes?view=meals');
  await page.locator('.page-head__add').click();
  const modal = topModal(page);
  await modal.locator('#meal-name input').waitFor();
  return modal;
};

const closeX = (page) => topModal(page).locator('ion-button.nt-sheet-close');
const modalCount = (page) => page.locator('ion-modal.show-modal').count();

export function register({ test }) {
  test('w1: Mahlzeit-Sheet X fragt nach "Weiter bearbeiten" erneut', seed(), async (page) => {
    await openCreate(page);
    await topModal(page).locator('#meal-name input').fill('Testmahlzeit');
    await closeX(page).click();
    const alert = page.locator('ion-alert', { hasText: 'Verwerfen?' });
    await alert.waitFor();
    await alert.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await alert.waitFor({ state: 'detached', timeout: 3000 });
    assert.equal(await modalCount(page), 1, 'Sheet muss offen bleiben');

    await settle(page, 400);
    await closeX(page).click();
    await page.locator('ion-alert', { hasText: 'Verwerfen?' }).waitFor({ timeout: 3000 });
    assert.equal(await page.locator('ion-alert', { hasText: 'Verwerfen?' }).count(), 1, 'genau ein Dialog');
  });

  test('w1: Mahlzeit-Sheet X mit "Verwerfen" schliesst', seed(), async (page) => {
    await openCreate(page);
    await topModal(page).locator('#meal-name input').fill('Testmahlzeit');
    await closeX(page).click();
    const alert = page.locator('ion-alert', { hasText: 'Verwerfen?' });
    await alert.waitFor();
    await alert.getByRole('button', { name: 'Verwerfen' }).click();
    await eventually(async () => assert.equal(await modalCount(page), 0, 'Sheet noch offen'), 4000);
  });

  test('w1: Mahlzeit-Sheet X ohne Aenderung schliesst sofort', seed(), async (page) => {
    await openCreate(page);
    await closeX(page).click();
    await eventually(async () => assert.equal(await modalCount(page), 0, 'Sheet noch offen'), 4000);
    assert.equal(await page.locator('ion-alert', { hasText: 'Verwerfen?' }).count(), 0, 'kein Dialog erwartet');
  });

  test('w1: Loesch-Toast der Mahlzeit ist kurz und wegwischbar', seed({ savedMeals: [MEAL] }), async (page) => {
    await go(page, 'recipes?view=meals');
    await page.locator('ion-button.nt-hover-delete').first().dispatchEvent('click');
    const toast = page.locator('ion-toast', { hasText: 'Mahlzeit gelöscht' });
    await toast.waitFor();
    const props = await toast.evaluate((t) => ({ duration: t.duration, swipeGesture: t.swipeGesture }));
    assert.ok(props.duration <= MAX_UNDO_TOAST_MS, `Dauer ${props.duration} > ${MAX_UNDO_TOAST_MS}`);
    assert.equal(props.swipeGesture, 'vertical');
  });

  test('w1: Rezept-Sheet X fragt nach "Weiter bearbeiten" erneut', seed(), async (page) => {
    await go(page, 'recipes');
    await page.locator('.page-head__add').click();
    const modal = topModal(page);
    await modal.locator('ion-input').first().locator('input').fill('Testrezept');
    await closeX(page).click();
    const alert = page.locator('ion-alert', { hasText: 'Verwerfen?' });
    await alert.waitFor();
    await alert.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await alert.waitFor({ state: 'detached', timeout: 3000 });
    await settle(page, 400);
    await closeX(page).click();
    await page.locator('ion-alert', { hasText: 'Verwerfen?' }).waitFor({ timeout: 3000 });
  });
}
