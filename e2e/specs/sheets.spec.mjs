// Sheets auf dem iPhone SE: Nährwert-Bereich bleibt offen (1.5), Abstand oben (1.6), Kopf ohne Überlappung (1.7).
import { assert, eventually, go, settle } from '../lib/harness.mjs';
import { ionInput, topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
/** Mindestabstand zwischen Bildschirmrand und Sheet (ohne Safe Area, die in Chromium 0 ist). */
const MIN_TOP_GAP_PX = 12;
const MIN_TAP_PX = 40;
const STAMP = new Date().toISOString();
const LONG_RECIPE = {
  id: 'r-long', title: 'Spaghetti Aglio e Olio mit geröstetem Knoblauch, Chili und frischer Petersilie', servings: 2,
  ingredients: [], steps: ['Kochen'], origin: 'manual', createdAt: STAMP, updatedAt: STAMP,
};

async function openAddSheet(page) {
  await go(page, 'diary');
  await page.locator('[data-testid="diary-add"]').click();
  const modal = topModal(page);
  await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).waitFor();
  return modal;
}

async function openManual(page) {
  const modal = await openAddSheet(page);
  await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
  await ionInput(modal, 'Name').waitFor();
  return modal;
}

const isAdjustOpen = (modal) => modal.locator('ion-accordion.accordion-expanded').count().then((n) => n > 0);

/** Abstand der Sheet-Oberkante zum Bildschirmrand (Shadow-DOM von ion-modal). */
const sheetTop = (page) => page.evaluate(() => {
  const modals = [...document.querySelectorAll('ion-modal.show-modal')];
  const wrapper = modals.at(-1)?.shadowRoot?.querySelector('.modal-wrapper');
  return wrapper ? Math.round(wrapper.getBoundingClientRect().top) : -1;
});

/** Misst Titel und Seitenaktionen des obersten Sheet-Kopfs. */
const headerGeometry = (page) => page.evaluate(() => {
  const modals = [...document.querySelectorAll('ion-modal.show-modal')];
  const head = modals.at(-1)?.querySelector('.nt-sheet-header');
  if (!head) return null;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height }; };
  const title = head.querySelector('.nt-sheet-header__title');
  const buttons = [...head.querySelectorAll('ion-button')].map(rect);
  const style = getComputedStyle(title);
  return {
    title: rect(title),
    buttons,
    overflowing: title.scrollWidth > title.clientWidth,
    ellipsis: style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap',
    headWidth: head.getBoundingClientRect().width,
    // ion-button reicht aria-label an den inneren Knopf weiter (Host verliert das Attribut).
    closeLabel: [...head.querySelectorAll('ion-button')].some((b) => (b.getAttribute('aria-label') ?? b.shadowRoot?.querySelector('button')?.getAttribute('aria-label')) === 'Schließen'),
    textButtons: [...head.querySelectorAll('ion-button')].map((b) => b.textContent.trim()).filter(Boolean),
  };
});

export function register({ test }) {
  test('sheets: Nährwerte anpassen bleibt offen beim Feldwechsel, Eingaben bleiben erhalten', seed(), async (page) => {
    const modal = await openManual(page);
    await ionInput(modal, 'Name').fill('Testgericht');
    // Das manuelle Formular startet mit offenem Bereich.
    await eventually(async () => assert.equal(await isAdjustOpen(modal), true, 'Bereich startet nicht offen'));

    const protein = ionInput(modal, 'Eiweiß (g)');
    const carbs = ionInput(modal, 'Kohlenhydrate (g)');
    await protein.click();
    await protein.fill('21');
    await carbs.click();
    await settle(page, 500);
    assert.equal(await isAdjustOpen(modal), true, 'Bereich klappt nach Eiweiß -> Kohlenhydrate zu');
    await carbs.fill('33');
    await ionInput(modal, 'Fett (g)').click();
    await settle(page, 500);
    assert.equal(await isAdjustOpen(modal), true, 'Bereich klappt nach Kohlenhydrate -> Fett zu');
    assert.equal(await protein.inputValue(), '21', 'Eiweiß-Wert verloren');
    assert.equal(await carbs.inputValue(), '33', 'Kohlenhydrate-Wert verloren');

    // Der Schalter "kcal selbst eingeben" liegt im selben Bereich und darf ihn ebenfalls nicht schließen.
    await modal.locator('ion-toggle', { hasText: 'kcal selbst eingeben' }).click();
    await settle(page, 500);
    assert.equal(await isAdjustOpen(modal), true, 'Bereich klappt nach kcal-Schalter zu');

    // Nur ein Tipp auf die Kopfzeile schließt den Bereich.
    await modal.locator('ion-accordion ion-item', { hasText: 'Nährwerte anpassen' }).click();
    await eventually(async () => assert.equal(await isAdjustOpen(modal), false, 'Kopfzeile schließt den Bereich nicht'));
  });

  for (const vp of VIEWPORTS) {
    test(`sheets: Abstand oben und Kopf ohne Überlappung bei ${vp.width}x${vp.height}`, seed(), async (page) => {
      await page.setViewportSize(vp);
      const modal = await openAddSheet(page);
      await settle(page, 1000); // Einblend-Animation abwarten, sonst misst man mitten im Hochschieben
      const top = await sheetTop(page);
      assert.ok(top >= MIN_TOP_GAP_PX, `Sheet-Abstand oben ${top} px`);

      await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
      await ionInput(modal, 'Name').waitFor();
      await modal.locator('.meal-chip[aria-label="Abendessen"]').click();
      const g = await headerGeometry(page);
      assert.ok(g, 'kein Sheet-Kopf');
      assert.equal(g.closeLabel || g.textButtons.length > 0, true);
      for (const b of g.buttons) {
        assert.ok(b.right <= g.title.left + 0.5 || b.left >= g.title.right - 0.5, `Titel ueberlappt Schaltflaeche (${JSON.stringify({ t: g.title, b })})`);
        assert.ok(b.width >= MIN_TAP_PX && b.height >= MIN_TAP_PX, `Tippflaeche zu klein: ${b.width}x${b.height}`);
      }
      assert.ok(g.title.right <= g.headWidth + 0.5, 'Titel ragt aus dem Kopf');

      // Abbrechen ist ein X mit Beschriftung "Schließen".
      const close = modal.locator('[data-testid="add-close"]');
      assert.equal(await close.locator('button').getAttribute('aria-label'), 'Schließen');
      assert.equal((await close.innerText()).trim(), '', 'Abbrechen-Text statt Icon');
    });
  }

  test('sheets: langer Titel wird mit Ellipsis gekürzt, X bleibt sichtbar (320 px)', seed({ recipes: [LONG_RECIPE] }), async (page) => {
    await page.setViewportSize(VIEWPORTS[1]);
    await go(page, 'recipes');
    await page.locator('.recipe__title-btn').first().click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title').waitFor();
    const g = await headerGeometry(page);
    assert.equal(g.ellipsis, true, 'Titel ohne Ellipsis');
    assert.equal(g.closeLabel, true, 'X "Schließen" fehlt');
    for (const b of g.buttons) assert.ok(b.right <= g.title.left + 0.5 || b.left >= g.title.right - 0.5, 'Titel ueberlappt Schaltflaeche');
  });

  const OPEN_PLAN = async (page) => {
    await go(page, 'shopping');
    await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click();
    await settle(page);
  };
  const sw = (page) => page.locator('[data-testid="own-recipes-toggle"] input[role="switch"]');

  test('weekplan: "Aus meinen Rezepten planen" ist ein Schalter mit sichtbarem Zustand', seed({}), async (page) => {
    await OPEN_PLAN(page);
    const toggle = page.locator('[data-testid="own-recipes-toggle"]');
    const state = page.locator('[data-testid="own-recipes-state"]');
    await toggle.waitFor();
    assert.equal(await toggle.evaluate((el) => el.tagName), 'ION-TOGGLE');
    assert.match(await toggle.innerText(), /Aus meinen Rezepten planen/);
    assert.equal(await sw(page).getAttribute('aria-checked'), 'false');
    assert.match(await state.innerText(), /^Aus/);
    assert.equal(await page.locator('[data-testid="week-plan-btn"]').count(), 1);
    assert.equal(await page.locator('[data-testid="own-plan-btn"]').count(), 0);

    await toggle.click();
    await eventually(async () => assert.match(await state.innerText(), /^An/));
    assert.equal(await sw(page).getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('[data-testid="own-plan-btn"]').count(), 1);
    assert.equal(await page.locator('[data-testid="week-plan-btn"]').count(), 0);

    await toggle.click();
    await eventually(async () => assert.match(await state.innerText(), /^Aus/));
  });

  test('weekplan: mit Standard-Zugang ist der Schalter aus und bedienbar', seed(), async (page) => {
    await OPEN_PLAN(page);
    await page.locator('[data-testid="own-recipes-toggle"]').waitFor();
    assert.equal(await sw(page).getAttribute('aria-checked'), 'false');
    assert.equal(await sw(page).isDisabled(), false);
  });
}
