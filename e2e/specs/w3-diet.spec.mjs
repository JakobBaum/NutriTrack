// Welle 3: Rezeptsuche-Einstellung entfällt, Ernährungsprofil (Auswahl, Layout, Such-Parameter).
import { assert, go, readStore, settle } from '../lib/harness.mjs';
import { seed, PROFILE } from '../lib/fixtures.mjs';
import { pickActionSheet, topModal } from '../lib/ionic.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MAX_OVERFLOW_PX = 1;
const MIN_TAP_PX = 44;
const MIN_FONT_PX = 16;
const LONG_DISLIKES = Array.from({ length: 15 }, (_, i) => `Sehr lange Zutat Nummer ${String(i).padStart(2, '0')} xx`.slice(0, 30));
const ALL_INTOLERANCES = ['dairy', 'egg', 'gluten', 'peanut', 'seafood', 'shellfish', 'soy', 'tree nut', 'wheat', 'sesame'];
const EMPTY_SEARCH = { offset: 0, number: 10, totalResults: 0, results: [] };

const openProfile = async (page) => {
  await page.locator('[data-testid="open-profile"]').click();
  const sheet = topModal(page);
  await sheet.locator('[data-testid="diet-select"]').waitFor();
  await settle(page, 500);
  return sheet;
};

const mockSearch = async (page, requests) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await page.route('https://*.workers.dev/recipes/complexSearch**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    requests.push(new URL(req.url()).searchParams);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(EMPTY_SEARCH) });
  });
};

const measureOverflow = (page) => page.evaluate(() => {
  const sheet = document.querySelector('ion-modal.show-modal .profile-sheet');
  const root = document.documentElement;
  return {
    sheet: sheet ? sheet.scrollWidth - sheet.clientWidth : null,
    page: root.scrollWidth - root.clientWidth,
  };
});

export function register({ test }) {
  test('w3 diet: Einstellungen zeigen keinen Abschnitt "Rezeptsuche" mehr', seed({}), async (page) => {
    await go(page, 'settings');
    const headers = await page.locator('ion-router-outlet .nt-section-header').allInnerTexts();
    assert.ok(headers.length > 0, 'Abschnittsüberschriften gefunden');
    assert.ok(!headers.some((h) => /Rezeptsuche/i.test(h)), `Überschriften: ${headers.join(' | ')}`);
    assert.equal(await page.locator('[data-testid="recipe-search-row"]').count(), 0);
    assert.equal(await page.locator('app-recipe-search-settings').count(), 0);
  });

  test('w3 diet: Ernährungsform im Profil wählen, speichern, neu laden', seed({}), async (page) => {
    await go(page, 'settings');
    let sheet = await openProfile(page);
    await sheet.locator('[data-testid="diet-select"]').click();
    await pickActionSheet(page, 'Vegan');
    await sheet.locator('[data-testid="intolerance-gluten"]').click();
    await sheet.locator('[data-testid="profile-save"]').click();
    await page.locator('ion-modal.show-modal').waitFor({ state: 'detached' });
    assert.equal((await readStore(page, 'profile')).diet, 'vegan');

    await page.reload({ waitUntil: 'load' });
    await settle(page, 600);
    assert.match(await page.locator('[data-testid="diet-summary"]').innerText(), /Vegan/);
    sheet = await openProfile(page);
    const value = await sheet.locator('[data-testid="diet-select"]').evaluate((el) => el.value);
    assert.equal(value, 'vegan');
    assert.equal(await sheet.locator('[data-testid="intolerance-gluten"]').getAttribute('aria-pressed'), 'true');
  });

  for (const vp of VIEWPORTS) {
    test(`w3 diet: Profil-Sheet läuft bei ${vp.width} px nicht über`, seed({
      profile: { ...PROFILE, diet: 'vegetarian', intolerances: ALL_INTOLERANCES, dislikes: LONG_DISLIKES, dislikesEn: LONG_DISLIKES.map(() => '') },
    }), async (page) => {
      await page.setViewportSize(vp);
      await go(page, 'settings');
      const sheet = await openProfile(page);
      await sheet.locator('[data-testid="dislike-chips"]').scrollIntoViewIfNeeded();
      await settle(page, 300);
      const overflow = await measureOverflow(page);
      assert.ok(overflow.sheet !== null && overflow.sheet <= MAX_OVERFLOW_PX, `Sheet-Überlauf ${overflow.sheet} px`);
      assert.ok(overflow.page <= MAX_OVERFLOW_PX, `Seiten-Überlauf ${overflow.page} px`);
      const input = await sheet.locator('[data-testid="dislike-input"] input').evaluate((el) => ({
        font: parseFloat(getComputedStyle(el).fontSize), height: el.closest('ion-input').getBoundingClientRect().height,
      }));
      assert.ok(input.font >= MIN_FONT_PX, `Schrift im Feld ${input.font} px`);
      assert.ok(input.height >= MIN_TAP_PX, `Feldhöhe ${input.height} px`);
    });
  }

  test('w3 diet: alter Deep-Link settings?open=recipe-search stürzt nicht ab', seed({}), async (page) => {
    await go(page, 'settings?open=recipe-search');
    assert.equal(await page.locator('[data-testid="open-profile"]').count(), 1, 'Einstellungen werden angezeigt');
    assert.equal(await page.locator('ion-modal.show-modal').count(), 0, 'kein Sheet öffnet sich');
  });

  test('w3 diet: Online-Suche sendet Profil-Parameter und lässt sie bei ausgeschaltetem Filter weg', seed({
    profile: { ...PROFILE, diet: 'vegetarian', intolerances: ['gluten', 'tree nut'], dislikes: ['Pilze'], dislikesEn: ['mushrooms'] },
  }), async (page) => {
    const requests = [];
    await mockSearch(page, requests);
    await go(page, 'recipes');
    await page.locator('[data-testid="online-search-btn"]').click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Rezepte online' }).waitFor();
    const chip = modal.locator('[data-testid="os-profile-filter"]');
    assert.match(await chip.innerText(), /Profil-Filter aktiv/);

    await modal.locator('ion-input input[aria-label="Rezept suchen"]').fill('lentil');
    await modal.locator('.os-search-btn').click();
    await settle(page, 600);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].get('diet'), 'vegetarian');
    assert.equal(requests[0].get('intolerances'), 'gluten,tree nut');
    assert.equal(requests[0].get('excludeIngredients'), 'mushrooms');

    // Umschalten sucht von selbst neu, damit Treffer und Nachladen nie zwei Filtersätze mischen.
    await chip.click();
    await settle(page, 600);
    assert.equal(await chip.getAttribute('aria-pressed'), 'false');
    assert.equal(requests.length, 2);
    assert.ok(!requests[1].get('diet'), 'diet ohne Profil-Filter');
    assert.equal(requests[1].get('intolerances'), null);
    assert.equal(requests[1].get('excludeIngredients'), null);
  });
}
