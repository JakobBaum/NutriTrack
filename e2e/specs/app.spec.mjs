// Onboarding/Profil, Einkaufsliste (Enter), Dashboard (Summen + Über-Ziel-Zustand).
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { ionInput, pickActionSheet, stepTo, topModal } from '../lib/ionic.mjs';
import { DIARY_NORMAL, DIARY_OVER, SHOPPING, seed } from '../lib/fixtures.mjs';

const sumKcal = (entries) => entries.reduce((s, e) => s + e.facts.kcal, 0);
/** Zahl aus deutsch formatiertem Text („2.884“ / „2 884“) lesen. */
const toInt = (text) => Number(String(text).replace(/[^\d]/g, ''));

async function pickSelect(page, modal, label, optionText) {
  await modal.locator('ion-select').filter({ hasText: label }).click();
  await pickActionSheet(page, optionText);
}

export function register({ test }) {
  test('onboarding: Profil einrichten setzt Tagesziel', null, async (page) => {
    await go(page, 'dashboard');
    await page.locator('h1', { hasText: 'Willkommen bei NutriTrack' }).waitFor();
    await page.locator('ion-button', { hasText: 'Profil einrichten' }).click();
    // ?setup=1 öffnet den Bedarfs-Berechner automatisch
    await page.waitForURL(/settings\?setup=1/);
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Mein Profil' }).waitFor();
    await stepTo(modal, 'Gewicht', { start: 75, step: 0.5, target: 72.5 });
    await stepTo(modal, 'Größe', { start: 175, step: 1, target: 175 });
    await stepTo(modal, 'Alter', { start: 30, step: 1, target: 28 });
    await pickSelect(page, modal, 'Geschlecht', 'Weiblich');
    await modal.locator('ion-button', { hasText: 'Speichern' }).click();
    await settle(page);

    const profile = await readStore(page, 'profile');
    assert.ok(profile, 'Profil nicht gespeichert');
    assert.equal(profile.weightKg, 72.5);
    assert.equal(profile.heightCm, 175);
    assert.equal(profile.sex, 'female');
    const kcal = toInt(await page.locator('.target-card__kcal .num').innerText());
    assert.ok(kcal > 1200 && kcal < 3500, `unplausibles Tagesziel ${kcal}`);

    await go(page, 'dashboard');
    await page.locator('.hero').waitFor();
    assert.equal(toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__target').innerText()), kcal);
  });

  test('shopping: Artikel mit Enter hinzufügen', seed({ shopping: SHOPPING }), async (page) => {
    await go(page, 'shopping');
    // "+" öffnet das Bottom Sheet
    await page.locator('ion-fab.add-fab ion-fab-button').click();
    await page.locator('ion-modal.add-sheet').waitFor({ state: 'visible' });
    const name = page.locator('ion-modal.add-sheet ion-input.add-name input');
    await name.fill('Hafermilch');
    await page.locator('ion-modal.add-sheet ion-input.add-amount input').fill('1,5');
    await name.press('Enter');
    await settle(page);
    const list = await readStore(page, 'shopping');
    const item = list.items.find((i) => i.name === 'Hafermilch');
    assert.ok(item, 'Artikel nicht gespeichert');
    assert.equal(item.amount, 1.5);
    await eventually(async () => assert.equal(await page.locator('.check-row__name', { hasText: 'Hafermilch' }).count(), 1));
    assert.equal(await name.inputValue(), '', 'Eingabefeld sollte geleert werden');
    assert.ok(await page.locator('ion-modal.add-sheet').isVisible(), 'Sheet bleibt für den nächsten Artikel offen');
    // zweites Enter mit leerem Feld darf nichts anlegen
    await name.press('Enter');
    await settle(page, 300);
    assert.equal((await readStore(page, 'shopping')).items.length, SHOPPING.items.length + 1);
  });

  test('dashboard: Summen gegessen/übrig', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'dashboard');
    const eaten = toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__eaten').innerText());
    const target = toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__target').innerText());
    assert.equal(eaten, sumKcal(DIARY_NORMAL));
    assert.match(await page.locator('.hero__item:not(.hero__item--protein) .hero__unit').innerText(), /kcal übrig/);
    assert.equal(toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__big').innerText()), target - eaten);
    assert.equal(await page.locator('.hero__item--over').count(), 0);
    const lunch = page.locator('.row__btn', { hasText: 'Mittagessen' });
    assert.equal(toInt(await lunch.locator('.row__note').innerText()), 520);
  });

  test('dashboard: Über-Ziel-Zustand', seed({ diary: DIARY_OVER }), async (page) => {
    await go(page, 'dashboard');
    const eaten = toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__eaten').innerText());
    const target = toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__target').innerText());
    assert.equal(eaten, sumKcal(DIARY_OVER));
    assert.ok(eaten > target, `Seed muss über Ziel liegen (${eaten} vs ${target})`);
    await page.locator('section.hero .hero__item--over').waitFor();
    assert.match(await page.locator('.hero__item:not(.hero__item--protein) .hero__unit').innerText(), /kcal über Ziel/);
    assert.equal(toInt(await page.locator('.hero__item:not(.hero__item--protein) .hero__big').innerText()), eaten - target);
    assert.match(await page.locator('.row__btn', { hasText: 'Fastfood-Helfer' }).innerText(), /Ziel überschritten/, 'Fastfood-Zeile soll Überschreitung nennen');
    const label = await page.locator('.hero__item:not(.hero__item--protein) .hero__main').getAttribute('aria-label');
    assert.match(label ?? '', /über/i, 'aria-label sollte Über-Ziel nennen');
  });

  test('dashboard: Mahlzeit trägt direkt auf Heute ein', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'dashboard');
    const eatenText = () => page.locator('.hero__item:not(.hero__item--protein) .hero__eaten').innerText();
    const before = toInt(await eatenText());
    await page.locator('.row__btn', { hasText: 'Mittagessen' }).click();
    const modal = topModal(page);
    await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
    await ionInput(modal, 'Name').waitFor();
    await ionInput(modal, 'Name').fill('Testbrot');
    await ionInput(modal, 'Kalorien (kcal)').fill('250');
    await modal.locator('.add-footer__save').click();
    await settle(page);

    assert.ok(!page.url().includes('/diary'), 'Heute-Seite darf nicht zum Tagebuch wechseln');
    const stored = (await readStore(page, 'diary')).find((e) => e.label === 'Testbrot');
    assert.ok(stored, 'Eintrag nicht gespeichert');
    assert.equal(stored.meal, 'lunch');
    await eventually(async () => assert.equal(toInt(await eatenText()), before + 250));
  });

  test('dashboard: Fastfood-Helfer öffnet als Sheet auf Heute', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'dashboard');
    await page.locator('.row__btn', { hasText: 'Fastfood-Helfer' }).click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Fastfood-Helfer' }).waitFor();
    assert.ok(!page.url().includes('/diary'), 'Fastfood-Helfer darf nicht zum Tagebuch navigieren');
    await modal.locator('ion-button', { hasText: 'Abbrechen' }).click();
    await settle(page);
    await page.locator('.hero').waitFor();
  });
}
