// Fehlerklasse "Layout klein": jedes Sheet bei 320x568 und 375x667 (Abstand oben, Kopf ohne Ueberlappung,
// kein Ueberlauf, Schrift >= 13 px, Tippflaechen >= 40 px). Siehe docs/review-2/FEHLERKLASSEN.md.
import { assert, go, settle } from '../lib/harness.mjs';
import { DIARY_NORMAL, WEIGHT_HISTORY, seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_FONT_PX = 13;
/** iOS zoomt beim Fokus in Felder unter 16 px hinein (Capacitor sperrt Pinch-Zoom): jedes Textfeld mindestens 16 px. */
const MIN_FIELD_FONT_PX = 16;
const MIN_TAP_PX = 40;
const MIN_TOP_GAP_PX = 12;
/** Kompakte Phones: Tab-Leiste mindestens 44 pt, hoechstens 64 px (vorher 76 gemessen); Tab-Beschriftung lesbar; Titel kleiner als vorher (34 px). */
const MIN_TABBAR_PX = 44;
const MAX_TABBAR_PX = 64;
const MIN_TAB_LABEL_PX = 11;
const MAX_TITLE_PX = 32;
const STAMP = new Date().toISOString();
const RECIPE = {
  id: 'r-a', title: 'Spaghetti Aglio e Olio mit geröstetem Knoblauch, Chili und frischer Petersilie', servings: 2,
  ingredients: [{ id: 'i1', name: 'Spaghetti', amount: 200, unit: 'g' }], steps: ['Kochen'], origin: 'manual', createdAt: STAMP, updatedAt: STAMP,
};
const SEED = () => seed({ diary: DIARY_NORMAL, weight: WEIGHT_HISTORY, recipes: [RECIPE] });

/** Name, Route, Oeffnen. */
const SHEETS = [
  ['Drill-Down', 'dashboard', (p) => p.locator('.hero__main').first().click()],
  ['Eintragen', 'diary', (p) => p.locator('[data-testid="diary-add"]').click()],
  ['Fastfood', 'diary', (p) => p.locator('.ff-btn').click()],
  ['Eintrag bearbeiten', 'diary', (p) => p.locator('ion-item[button]').first().click()],
  ['Rezept neu', 'recipes', (p) => p.getByRole('button', { name: 'Neues Rezept' }).click()],
  ['Rezept Detail', 'recipes', (p) => p.locator('.recipe__title-btn').first().click()],
  ['Rezept importieren', 'recipes', (p) => p.locator('[data-testid="import-btn"]').click()],
  ['Online-Suche', 'recipes', (p) => p.locator('[data-testid="online-search-btn"]').click()],
  ['Mahlzeit anlegen', 'recipes', async (p) => {
    await p.locator('ion-segment-button', { hasText: 'Mahlzeiten' }).click();
    await settle(p, 400);
    await p.getByRole('button', { name: 'Neue Mahlzeit' }).click();
  }],
  ['Profil', 'settings', (p) => p.locator('[data-testid="open-profile"]').click()],
  ['Anleitung', 'settings', (p) => p.locator('ion-item[button]', { hasText: 'Anleitung' }).first().click()],
  ['Gewicht eintragen', 'settings', (p) => p.locator('[data-testid="weight-add"]').click()],
  ['Artikel hinzufuegen', 'shopping', (p) => p.locator('ion-fab-button').click()],
];

/** Misst das oberste Modal. Gibt eine Liste Probleme zurueck. */
function audit(page, limits) {
  return page.evaluate(({ minFont, minTap, minGap }) => {
    const modal = [...document.querySelectorAll('ion-modal.show-modal')].at(-1);
    if (!modal) return ['kein Modal offen'];
    const problems = [];
    const wrapper = modal.shadowRoot?.querySelector('.modal-wrapper');
    const top = wrapper ? Math.round(wrapper.getBoundingClientRect().top) : -1;
    if (top < minGap) problems.push(`Abstand oben ${top}px`);
    const head = modal.querySelector('.nt-sheet-header');
    if (!head) problems.push('kein .nt-sheet-header');
    else {
      const title = head.querySelector('.nt-sheet-header__title')?.getBoundingClientRect();
      for (const b of head.querySelectorAll('ion-button, button')) {
        const r = b.getBoundingClientRect();
        if (r.width === 0) continue;
        if (title && !(r.right <= title.left + 0.5 || r.left >= title.right - 0.5)) problems.push(`Titel ueberlappt "${b.textContent.trim() || b.className}"`);
        if (r.width < minTap || r.height < minTap) problems.push(`Kopf-Knopf ${Math.round(r.width)}x${Math.round(r.height)}`);
        if (/abbrechen/i.test(b.textContent)) problems.push('Text "Abbrechen" im Kopf');
      }
    }
    const over = document.documentElement.scrollWidth - window.innerWidth;
    if (over > 0) problems.push(`Seite ${over}px zu breit`);
    const scroller = modal.querySelector('ion-content')?.shadowRoot?.querySelector('.inner-scroll');
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) problems.push(`Inhalt ${scroller.scrollWidth - scroller.clientWidth}px zu breit`);
    const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent.trim();
      if (!text || !el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const font = getComputedStyle(el).fontSize;
      if (parseFloat(font) < minFont) problems.push(`Schrift ${font} "${text.slice(0, 24)}"`);
      if (r.right > window.innerWidth + 1) problems.push(`ragt heraus "${text.slice(0, 24)}"`);
    }
    return problems;
  }, limits);
}

/** Sichtbare Textfelder (input/textarea/select, auch in Shadow-DOM) im obersten Modal bzw. auf der Seite; ion-select-Hosts zaehlen mit. */
function fieldFontProblems(page, minField) {
  return page.evaluate((min) => {
    const SKIP_TYPES = new Set(['checkbox', 'radio', 'hidden', 'range', 'file', 'button', 'submit', 'image', 'color']);
    const modal = [...document.querySelectorAll('ion-modal.show-modal')].at(-1);
    const root = modal ?? document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') ?? document.body;
    const found = [];
    const collect = (node) => {
      for (const el of node.querySelectorAll('input, textarea, select, ion-select')) found.push(el);
      for (const host of node.querySelectorAll('*')) if (host.shadowRoot) collect(host.shadowRoot);
    };
    collect(root);
    const problems = [];
    for (const el of found) {
      if (el.tagName === 'INPUT' && SKIP_TYPES.has(el.type)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const font = parseFloat(getComputedStyle(el).fontSize);
      if (font < min) problems.push(`Feldschrift ${font}px <${el.tagName.toLowerCase()}> ${(el.getAttribute('aria-label') ?? el.id ?? el.className).toString().slice(0, 24)}`);
    }
    return problems;
  }, minField);
}

const PAGES = ['dashboard', 'diary', 'recipes', 'shopping', 'settings'];

/** Seite (ohne Tab-Leiste): Ueberlauf, Schrift >= 13 px, Tippflaechen >= 40 px, Tab-Leiste >= 44 px hoch. */
function auditPage(page, limits) {
  return page.evaluate(({ minFont, minTap, minBar, maxBar, minTabLabel, maxTitle }) => {
    const problems = [];
    const over = document.documentElement.scrollWidth - window.innerWidth;
    if (over > 0) problems.push(`Seite ${over}px zu breit`);
    const bar = document.querySelector('ion-tab-bar')?.getBoundingClientRect();
    if (bar && (bar.height < minBar || bar.height > maxBar)) problems.push(`Tab-Leiste ${Math.round(bar.height)}px hoch`);
    for (const label of document.querySelectorAll('ion-tab-button ion-label')) {
      const font = parseFloat(getComputedStyle(label).fontSize);
      if (font < minTabLabel) problems.push(`Tab-Beschriftung ${font}px`);
    }
    const title = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden) .nt-large-title');
    if (title && parseFloat(getComputedStyle(title).fontSize) > maxTitle) problems.push(`Seitentitel ${getComputedStyle(title).fontSize} (kompakt <= ${maxTitle}px)`);
    const root = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent.trim();
      if (!text || !el || el.closest('ion-tab-bar')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const font = getComputedStyle(el).fontSize;
      if (parseFloat(font) < minFont) problems.push(`Schrift ${font} "${text.slice(0, 24)}"`);
      if (r.right > window.innerWidth + 1) problems.push(`ragt heraus "${text.slice(0, 24)}"`);
    }
    for (const b of root.querySelectorAll('button, ion-button, ion-segment-button, ion-item[button], a[href]')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < minTap) problems.push(`Tippflaeche ${Math.round(r.width)}x${Math.round(r.height)} ${b.className.toString().slice(0, 30) || b.tagName}`);
    }
    return problems;
  }, limits);
}

export function register({ test }) {
  for (const vp of VIEWPORTS) {
    for (const route of PAGES) {
      test(`page-audit: ${route} bei ${vp.width}x${vp.height}`, SEED(), async (page) => {
        await page.setViewportSize(vp);
        await go(page, route);
        await settle(page, 600);
        const problems = [...new Set(await auditPage(page, { minFont: MIN_FONT_PX, minTap: MIN_TAP_PX, minBar: MIN_TABBAR_PX, maxBar: MAX_TABBAR_PX, minTabLabel: MIN_TAB_LABEL_PX, maxTitle: MAX_TITLE_PX }))];
        assert.deepEqual(problems, [], `${route}: ${problems.join('; ')}`);
        const fieldProblems = [...new Set(await fieldFontProblems(page, MIN_FIELD_FONT_PX))];
        assert.deepEqual(fieldProblems, [], `${route}: ${fieldProblems.join('; ')}`);
      });
    }
  }
  for (const vp of VIEWPORTS) {
    for (const [name, route, open] of SHEETS) {
      test(`sheet-audit: ${name} bei ${vp.width}x${vp.height}`, SEED(), async (page) => {
        await page.setViewportSize(vp);
        await go(page, route);
        await open(page);
        await page.locator('ion-modal.show-modal').last().waitFor();
        await settle(page, 1000);
        const problems = await audit(page, { minFont: MIN_FONT_PX, minTap: MIN_TAP_PX, minGap: MIN_TOP_GAP_PX });
        assert.deepEqual(problems, [], `${name}: ${problems.join('; ')}`);
        const fieldProblems = [...new Set(await fieldFontProblems(page, MIN_FIELD_FONT_PX))];
        assert.deepEqual(fieldProblems, [], `${name}: ${fieldProblems.join('; ')}`);
      });
    }
  }
}
