// Lebensmittelsuche ohne Bilder, eigene Lebensmittel überall, KI-Verbindung nur global (Einstellungen).
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { ionInput, topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const OWN = {
  id: 'c-1', name: 'Joghurt Natur Eigen', createdAt: '2026-01-01T00:00:00.000Z',
  facts: { kcal: 70, proteinG: 5, carbsG: 6, fatG: 3, fiberG: 0, sugarG: 0, basis: 'perPortion' },
};
const OFF_HITS = {
  hits: [
    {
      code: '111', product_name: 'Joghurt Bio', brands: 'Alpro', quantity: '500 g', nutriscore_grade: 'b',
      image_small_url: 'https://images.example/joghurt.jpg',
      nutriments: { 'energy-kcal_100g': 60, proteins_100g: 4, carbohydrates_100g: 7, fat_100g: 2 },
    },
    { code: '222', product_name: 'Joghurt Vanille', nutriments: { 'energy-kcal_100g': 95, proteins_100g: 3 } },
  ],
};

/** Beantwortet die Open-Food-Facts-Suche lokal (Dev-Proxy und Worker-Adresse). */
async function mockOffSearch(page) {
  await page.route((url) => url.pathname.endsWith('/off-search'), (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(OFF_HITS),
  }));
}

async function openDiarySearch(page) {
  await go(page, 'diary');
  await page.locator('[data-testid="diary-add"]').click();
  return topModal(page);
}

async function searchIn(modal, term) {
  await modal.locator('ion-searchbar input').fill(term);
  await modal.locator('nt-food-row').first().waitFor();
}

export function register({ test }) {
  test('suche: eigenes Lebensmittel steht oben, markiert „Eigen“, Treffer ohne Bilder', seed({ customFoods: [OWN] }), async (page) => {
    await mockOffSearch(page);
    const modal = await openDiarySearch(page);
    await searchIn(modal, 'joghurt');
    await eventually(async () => assert.equal(await modal.locator('nt-food-row').count(), 3));

    const first = modal.locator('nt-food-row').first();
    assert.match(await first.innerText(), /Joghurt Natur Eigen/);
    assert.equal(await first.locator('.own-tag').innerText(), 'Eigen');
    assert.match(await first.locator('.meta').innerText(), /70 kcal · 5 g Eiweiß \/ Portion/);

    const off = modal.locator('nt-food-row').nth(1);
    assert.equal(await off.locator('.own-tag').count(), 0, 'OFF-Treffer ist nicht „Eigen“');
    assert.match(await off.innerText(), /Alpro · 500 g/);
    assert.match(await off.innerText(), /60 kcal · 4 g Eiweiß \/ 100 g/);
    assert.equal(await off.locator('.score').getAttribute('aria-label'), 'Nutri-Score B');
    assert.equal(await modal.locator('nt-food-row img').count(), 0, 'keine Produktbilder');
    assert.equal(await modal.locator('nt-food-row .score').count(), 1, 'Score nur wo vorhanden');
  });

  test('suche: eigenes Lebensmittel antwortet auch ohne Online-Treffer und füllt das Formular', seed({ customFoods: [OWN] }), async (page) => {
    // OFF bleibt vom Harness gesperrt (503): eigene Treffer müssen trotzdem erscheinen.
    const modal = await openDiarySearch(page);
    await searchIn(modal, 'natur');
    assert.equal(await modal.locator('nt-food-row').count(), 1);
    await modal.locator('nt-food-row').first().click();
    await ionInput(modal, 'Name').waitFor();
    assert.equal(await ionInput(modal, 'Name').inputValue(), 'Joghurt Natur Eigen');
  });

  test('suche: manuell eingetragenes Lebensmittel landet im Speicher und wird bei Mahlzeiten gefunden', seed(), async (page) => {
    const modal = await openDiarySearch(page);
    await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
    await ionInput(modal, 'Name').fill('Hausmüsli');
    await ionInput(modal, 'Kalorien (kcal)').fill('410');
    await modal.locator('.add-footer__save').click();
    await settle(page);

    const stored = await readStore(page, 'customFoods');
    assert.ok(stored?.some((f) => f.name === 'Hausmüsli' && f.facts.kcal === 410), 'manuelles Lebensmittel nicht gespeichert');

    await go(page, 'meals');
    await page.locator('.nt-add-btn', { hasText: 'Erste Mahlzeit anlegen' }).click();
    const create = topModal(page);
    await create.locator('.nt-add-btn', { hasText: 'Lebensmittel hinzufügen' }).click();
    const picker = topModal(page);
    await picker.locator('nt-food-row', { hasText: 'Hausmüsli' }).first().waitFor();
    assert.equal(await picker.locator('.own-tag').first().innerText(), 'Eigen', 'ohne Suchbegriff: zuletzt genutzte eigene');
    await picker.locator('ion-searchbar input').fill('musli');
    await eventually(async () => assert.ok((await picker.locator('nt-food-row', { hasText: 'Hausmüsli' }).count()) >= 1));
  });

  test('suche: eigene Lebensmittel erscheinen bei Rezept-Zutaten', seed({ customFoods: [OWN] }), async (page) => {
    await go(page, 'recipes');
    await page.getByRole('button', { name: 'Neues Rezept' }).click();
    const modal = topModal(page);
    await modal.locator('.nt-add-btn', { hasText: 'Zutat hinzufügen' }).click();
    const picker = topModal(page);
    await picker.locator('nt-food-row', { hasText: 'Joghurt Natur Eigen' }).waitFor();
    await picker.locator('nt-food-row', { hasText: 'Joghurt Natur Eigen' }).click();
    await settle(page);
    assert.match(await topModal(page).innerText(), /70 kcal/, 'Zutat mit Nährwerten übernommen');
  });

  test('einstellungen: KI-Verbindung nur global, alter Key wird gelöscht', seed({
    'ai-config': { provider: 'gemini', apiKey: 'alter-key', proxyUrl: 'https://alt.example' },
  }), async (page) => {
    await go(page, 'settings');
    assert.equal(await readStore(page, 'ai-config'), null, 'alte KI-Verbindung muss beim Start verworfen werden');
    // KI-Status: reine Anzeige in der Zeile, kein Sheet, keine Eingabefelder.
    const row = page.locator('[data-testid="ai-status-row"]');
    await row.waitFor();
    assert.equal(await row.locator('ion-input, ion-select, details').count(), 0, 'keine Eingabefelder');
    assert.doesNotMatch(await row.innerText(), /Erweitert|Schlüssel einfügen|Speichern/);
    // Harness sperrt den Worker (503): Status zeigt ehrlich „Nicht erreichbar“ oder „Verbunden“.
    await eventually(async () => assert.match(await page.locator('[data-testid="ai-status-badge"]').innerText(), /Verbunden|Nicht erreichbar/));
  });
}
