// Tagebuch: manuelle Einträge, Einheitenwechsel, Schnellwahl, Dezimalkomma, Bearbeiten, Löschen + Rückgängig.
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { amountInput, clickToastButton, ionInput, pickUnit, topModal } from '../lib/ionic.mjs';
import { DIARY_NORMAL, SCALABLE_ENTRY, seed } from '../lib/fixtures.mjs';

const MENGE_MANUAL = 'Menge (optional)';

/** Öffnet das Eintragen-Sheet im manuellen Formular. */
async function openManual(page) {
  await go(page, 'diary');
  await page.locator('.page-head__add').click();
  const modal = topModal(page);
  await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
  await ionInput(modal, 'Name').waitFor();
  return modal;
}

async function saveForm(page, modal) {
  await modal.locator('.add-footer__save').click();
  await settle(page);
}

const diaryEntry = (page, label) => page.locator('ion-item-sliding ion-item', { has: page.locator(`h3:text-is("${label}")`) });
const findStored = async (page, label) => (await readStore(page, 'diary')).find((e) => e.label === label);

export function register({ test }) {
  test('diary: manuell in ml, Wechsel auf l zeigt 0,5', seed(), async (page) => {
    const modal = await openManual(page);
    await ionInput(modal, 'Name').fill('Orangensaft');
    const amount = amountInput(modal, MENGE_MANUAL);
    await amount.fill('500');
    assert.match(await modal.locator('.amount__unit').innerText(), /ml/, 'Saft sollte automatisch ml vorschlagen');
    await pickUnit(page, modal, 'l');
    await eventually(async () => assert.equal(await amount.inputValue(), '0,5'));
    await ionInput(modal, 'Kalorien (kcal)').fill('220');
    await saveForm(page, modal);

    const stored = await findStored(page, 'Orangensaft');
    assert.ok(stored, 'Eintrag nicht gespeichert');
    assert.equal(stored.amountG, 500);
    assert.equal(stored.unit, 'l');
    assert.equal(stored.facts.kcal, 220);
    await eventually(async () => assert.match(await diaryEntry(page, 'Orangensaft').innerText(), /0,5 l/));
  });

  test('diary: Schnellwahl-Chip setzt Menge (g und kg)', seed(), async (page) => {
    const modal = await openManual(page);
    await ionInput(modal, 'Name').fill('Reis');
    const amount = amountInput(modal, MENGE_MANUAL);
    await modal.locator('.quick-chip', { hasText: /^\s*150\s*$/ }).click();
    await eventually(async () => assert.equal(await amount.inputValue(), '150'));
    await pickUnit(page, modal, 'kg');
    await eventually(async () => assert.equal(await amount.inputValue(), '0,15'));
    await modal.locator('.quick-chip', { hasText: /^\s*0,25\s*$/ }).click();
    await eventually(async () => assert.equal(await amount.inputValue(), '0,25'));
    await ionInput(modal, 'Kalorien (kcal)').fill('320');
    await saveForm(page, modal);

    const stored = await findStored(page, 'Reis');
    assert.equal(stored?.amountG, 250);
    assert.equal(stored?.unit, 'kg');
    await eventually(async () => assert.match(await diaryEntry(page, 'Reis').innerText(), /0,25 kg/));
  });

  test('diary: Dezimalkomma in Menge und Nährwerten', seed(), async (page) => {
    const modal = await openManual(page);
    await ionInput(modal, 'Name').fill('Walnüsse');
    await amountInput(modal, MENGE_MANUAL).fill('12,5');
    await ionInput(modal, 'Kalorien (kcal)').fill('82');
    await ionInput(modal, 'Eiweiß (g)').fill('1,9');
    await ionInput(modal, 'Fett (g)').fill('8,2');
    await assert.equal(await ionInput(modal, 'Eiweiß (g)').inputValue(), '1,9', 'Tipptext mit Komma muss erhalten bleiben');
    await saveForm(page, modal);

    const stored = await findStored(page, 'Walnüsse');
    assert.equal(stored?.amountG, 12.5);
    assert.equal(stored?.facts.proteinG, 1.9);
    assert.equal(stored?.facts.fatG, 8.2);
    await eventually(async () => assert.match(await diaryEntry(page, 'Walnüsse').innerText(), /12,5 g[\s\S]*E 1,9 g/));
  });

  test('diary: Eintrag bearbeiten (Name + Menge skaliert kcal)', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    await diaryEntry(page, SCALABLE_ENTRY.label).click();
    const modal = topModal(page);
    await modal.locator('ion-title', { hasText: 'Eintrag bearbeiten' }).waitFor();
    await ionInput(modal, 'Name').fill('Haferflocken kernig');
    await amountInput(modal, 'Menge').fill('150');
    await modal.locator('.sheet-header__save').click();
    await settle(page);

    const stored = (await readStore(page, 'diary')).find((e) => e.id === SCALABLE_ENTRY.id);
    assert.equal(stored?.label, 'Haferflocken kernig');
    assert.equal(stored?.amountG, 150);
    assert.equal(stored?.facts.kcal, 555, 'kcal sollten von 370 auf 555 skaliert werden');
    await eventually(async () => assert.match(await diaryEntry(page, 'Haferflocken kernig').innerText(), /150 g[\s\S]*555 kcal/));
  });

  test('diary: Löschen + Rückgängig stellt Eintrag wieder her', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    await diaryEntry(page, 'Linsencurry').click();
    const modal = topModal(page);
    await modal.locator('.edit-delete', { hasText: 'Eintrag löschen' }).click();
    await settle(page, 400);
    await eventually(async () => assert.equal(await diaryEntry(page, 'Linsencurry').count(), 0));
    assert.equal(await findStored(page, 'Linsencurry'), undefined, 'Eintrag sollte gelöscht sein');

    await clickToastButton(page, 'Rückgängig');
    await eventually(async () => assert.equal(await diaryEntry(page, 'Linsencurry').count(), 1));
    const restored = await findStored(page, 'Linsencurry');
    assert.equal(restored?.meal, 'lunch');
    assert.equal(restored?.facts.kcal, 520);
  });
}
