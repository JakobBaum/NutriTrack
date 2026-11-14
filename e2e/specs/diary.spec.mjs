// Tagebuch: manuelle Einträge, Einheitenwechsel, Schnellwahl, Dezimalkomma, Bearbeiten, Löschen + Rückgängig.
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { amountInput, clickToastButton, ionInput, pickUnit, topModal } from '../lib/ionic.mjs';
import { DIARY_NORMAL, SCALABLE_ENTRY, seed } from '../lib/fixtures.mjs';

const MENGE_MANUAL = 'Menge (optional)';

/** Öffnet das Eintragen-Sheet im manuellen Formular. */
async function openManual(page) {
  await go(page, 'diary');
  await page.locator('[data-testid="diary-add"]').click();
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
    await eventually(async () => assert.match(await diaryEntry(page, 'Walnüsse').innerText(), /12,5 g[\s\S]*Eiweiß\s+1,9 g/));
  });

  test('diary: Eintrag bearbeiten (Name + Menge skaliert kcal)', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    await diaryEntry(page, SCALABLE_ENTRY.label).click();
    const modal = topModal(page);
    await modal.locator('.nt-sheet-header__title', { hasText: 'Eintrag bearbeiten' }).waitFor();
    await ionInput(modal, 'Name').fill('Haferflocken kernig');
    await amountInput(modal, 'Menge').fill('150');
    await modal.locator('[data-testid="edit-save"]').click();
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
  test('diary: Mehr-Menü trägt doppelt ein und löscht', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    const row = page.locator('.entry-row', { has: page.locator('h3:text-is("Linsencurry")') });
    await row.locator('[data-testid="entry-more"]').click();
    await page.locator('ion-action-sheet button', { hasText: 'Doppelt eintragen' }).click();
    await eventually(async () => assert.equal(await diaryEntry(page, 'Linsencurry').count(), 2));
    await row.first().locator('[data-testid="entry-more"]').click();
    await page.locator('ion-action-sheet button', { hasText: 'Löschen' }).click();
    await eventually(async () => assert.equal(await diaryEntry(page, 'Linsencurry').count(), 1));
  });

  // Welle 2: Tagebuch-Aktionen nur als Symbole, Sheet-Fuss, Trennlinie.
  test('diary: Zeilen- und Mahlzeit-Aktionen sind nur Symbole mit aria-label, Tippflaeche 44', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    const m = await page.evaluate(() => {
      const root = document.querySelector('ion-tabs ion-router-outlet > .ion-page:not(.ion-page-hidden)');
      const info = (el) => { const r = el.getBoundingClientRect(); return { text: el.textContent.trim(), label: el.getAttribute('aria-label') ?? el.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? '', w: r.width, h: r.height }; };
      return {
        options: [...root.querySelectorAll('ion-item-option')].map(info),
        more: [...root.querySelectorAll('[data-testid="entry-more"]')].map(info),
        add: [...root.querySelectorAll('.meal__add')].map(info),
        moreBg: getComputedStyle(root.querySelector('[data-testid="entry-more"]')).backgroundColor,
      };
    });
    assert.ok(m.options.length >= 3 && m.more.length >= 1 && m.add.length >= 1, 'Aktionen nicht gefunden');
    for (const o of m.options) { assert.equal(o.text, '', `Wisch-Aktion mit Text: "${o.text}"`); assert.ok(o.label !== '', 'Wisch-Aktion ohne aria-label'); }
    for (const b of [...m.more, ...m.add]) { assert.equal(b.text, ''); assert.ok(b.label !== ''); assert.ok(b.w >= 43.5 && b.h >= 43.5, `Tippflaeche ${b.w}x${b.h}`); }
    assert.ok(m.moreBg.replace(/\s/g, '') === 'rgba(0,0,0,0)' || m.moreBg === 'transparent', `"..." hat Flaeche: ${m.moreBg}`);
  });

  test('diary: letzte Zeile einer Karte ohne Trennlinie', seed({ diary: DIARY_NORMAL }), async (page) => {
    await go(page, 'diary');
    const rows = await page.evaluate(() => [...document.querySelectorAll('ion-tabs ion-router-outlet > .ion-page:not(.ion-page-hidden) .entry-row')].map((row) => ({
      last: !row.nextElementSibling, border: getComputedStyle(row.querySelector('ion-item')).getPropertyValue('--inner-border-width').trim(),
    })));
    assert.ok(rows.some((r) => r.last), 'keine Karte mit Eintraegen');
    for (const r of rows.filter((x) => x.last)) assert.equal(r.border, '0', `Trennlinie an letzter Zeile: "${r.border}"`);
  });

  for (const [name, open, saveSel] of [
    ['Bearbeiten', async (page) => { await diaryEntry(page, SCALABLE_ENTRY.label).click(); }, '[data-testid="edit-save"]'],
    ['Eintragen', async (page) => { await page.locator('[data-testid="diary-add"]').click(); const m = topModal(page); await m.locator('.nt-source-btn', { hasText: 'Manuell' }).click(); await ionInput(m, 'Name').waitFor(); }, '.add-footer__save'],
    ['Fastfood', async (page) => { await page.locator('.ff-btn').click(); }, '[data-testid="ff-run"]'],
  ]) {
    test(`diary: Sheet ${name}: X rechts, Bestaetigen unten in voller Breite, 44 hoch`, seed({ diary: DIARY_NORMAL }), async (page) => {
      await go(page, 'diary');
      await open(page);
      const modal = topModal(page);
      await modal.locator(saveSel).waitFor();
      await settle(page, 900);
      const m = await modal.evaluate((el, sel) => {
        const q = (s) => el.querySelector(s)?.getBoundingClientRect() ?? null;
        return { vw: window.innerWidth, vh: window.innerHeight, close: q('ion-button.nt-sheet-close'), save: q(sel), header: q('.nt-sheet-header'), gutter: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nt-page-gutter')) };
      }, saveSel);
      assert.ok(m.close && m.save, 'X oder Bestaetigen fehlt');
      assert.ok(m.close.left >= m.vw / 2, `X nicht rechts (x ${m.close.left})`);
      assert.ok(Math.abs(m.save.width - (m.vw - 2 * m.gutter)) <= 2, `Button ${m.save.width}px statt ${m.vw - 2 * m.gutter}`);
      assert.ok(Math.abs(m.save.height - 44) <= 0.6, `Button ${m.save.height}px hoch`);
      assert.ok(m.save.top > m.header.bottom && m.save.bottom <= m.vh + 0.5, 'Button nicht unten sichtbar');
    });
  }
}
