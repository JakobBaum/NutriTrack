// Gewichtsverlauf im Profil: Eintragen, Diagramm/Trend, Zielgewicht, Hinweis "Ziel neu berechnen".
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { stepTo, topModal } from '../lib/ionic.mjs';
import { TODAY, WEIGHT_HISTORY, seed } from '../lib/fixtures.mjs';

export function register({ test }) {
  test('weight: leer zeigt Hinweis, Eintragen speichert Gewicht von heute', seed(), async (page) => {
    await go(page, 'settings');
    await page.locator('[data-testid="weight-empty"]').waitFor();
    await page.locator('[data-testid="weight-add"]').click();
    const modal = topModal(page);
    await stepTo(modal, 'Gewicht', { start: 78, step: 0.1, target: 78.3 });
    await modal.locator('[data-testid="weight-save"]').click();
    await settle(page);

    const stored = await readStore(page, 'weight');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].dateISO, TODAY);
    assert.equal(stored[0].kg, 78.3);
    await eventually(async () => assert.match(await page.locator('[data-testid="weight-latest"]').innerText(), /78,3/));
  });

  test('weight: Verlauf zeigt Diagramm und Trend in kg pro Woche', seed({ weight: WEIGHT_HISTORY }), async (page) => {
    await go(page, 'settings');
    await page.locator('[data-testid="weight-chart"] svg').waitFor();
    const trend = await page.locator('[data-testid="weight-trend"]').innerText();
    assert.match(trend, /kg/i, `Trend-Text unerwartet: ${trend}`);
    assert.equal(await page.locator('[data-testid="weight-drift"]').count(), 0, 'Hinweis bei 1,4 kg Abweichung unerwartet');
  });

  test('weight: ab 2 kg Abweichung erscheint Hinweis, Neuberechnen öffnet Profil mit neuem Gewicht', seed({ weight: [{ dateISO: TODAY, kg: 75.5 }] }), async (page) => {
    await go(page, 'settings');
    await page.locator('[data-testid="weight-drift"]').waitFor();
    assert.equal((await readStore(page, 'profile')).weightKg, 78, 'nichts darf automatisch gespeichert werden');
    await page.locator('[data-testid="weight-drift"] button', { hasText: 'Ziel neu berechnen' }).click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Mein Profil' }).waitFor();
    await eventually(async () => assert.match(await modal.locator('nt-stepper[label="Gewicht"] .stepper__value').innerText(), /75,5/));
    await modal.locator('ion-button', { hasText: 'Speichern' }).click();
    await settle(page, 500);
    const profile = await readStore(page, 'profile');
    assert.equal(profile.weightKg, 75.5, 'Profilgewicht wurde nicht übernommen');
    await eventually(async () => assert.equal(await page.locator('[data-testid="weight-drift"]').count(), 0));
  });
}
