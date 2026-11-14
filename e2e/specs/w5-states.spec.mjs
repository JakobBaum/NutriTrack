// Welle 5: Laufzeitpruefung der Zustaende Leer, Fehler (500, 429, Abbruch) und Offline bei 375x667 und 320x568.
// Kein Test erreicht echte Dienste: jede externe Anfrage wird abgefangen (siehe installNet).
// Screenshots: Ordner aus W5_SHOT_DIR (Standard e2e/artifacts/w5), Name <bereich>-<zustand>-<breite>.png.
import fs from 'node:fs';
import path from 'node:path';
import { assert, BASE_URL, ARTIFACTS, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { amountInput, ionInput, topModal } from '../lib/ionic.mjs';
import { DIARY_NORMAL, PROFILE, SHOPPING, seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const MIN_TAP_PX = 40;
const SPINNER_GONE_MS = 5000;
const SHOT_DIR = process.env.W5_SHOT_DIR ?? path.join(ARTIFACTS, 'w5');
const BAD_TOKENS = /\b(NaN|undefined|null|Infinity)\b|\[object/;
const TECHNICAL = /\bHTTP\b|\b[45]\d\d\b|\bError\b|Exception|Failed to fetch|\bstatus\b/i;
const SUCCESS_WORDS = /erstellt|importiert|gespeichert|eingetragen|Treffer|erfolgreich/i;
const STAMP = new Date().toISOString();
const RECIPE = {
  id: 'r-w5', title: 'Linsentopf', servings: 2,
  ingredients: [{ id: 'i1', name: 'Rote Linsen', amount: 200, unit: 'g' }], steps: ['Kochen'], origin: 'manual', createdAt: STAMP, updatedAt: STAMP,
};
const IMPORT_TEXT = 'Pfannkuchen\n200 g Mehl\n2 Eier\n300 ml Milch\nAlles verrühren und braten.';
const IMPORT_URL = 'https://example.com/rezept';

const { profile: _omitProfile, ...SEED_WITHOUT_PROFILE } = seed();
const withoutProfile = (overrides = {}) => ({ ...SEED_WITHOUT_PROFILE, ...overrides });

// ---------------------------------------------------------------- Netz

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': '*' };
const hostKind = (url) => {
  const host = new URL(url).hostname;
  if (host.endsWith('workers.dev')) return 'worker';
  if (host.startsWith('prices.') && host.endsWith('openfoodfacts.org')) return 'prices';
  if (host.endsWith('openfoodfacts.org')) return 'off';
  if (host.includes('spoonacular')) return 'img';
  return 'other';
};

/**
 * Faengt jede Anfrage an eine fremde Domain ab. Modus: 'ok' (200 leer), '500', '429', 'abort' (Verbindungsabbruch).
 * `net.calls` haelt alle Anfragen mit Inhalt (ohne ping/health), `net.leaks` Anfragen an unbekannte Hosts.
 */
async function installNet(page, mode = 'ok') {
  const net = { mode, calls: [], leaks: [], all: [] };
  await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname) && /^https?:$/.test(url.protocol), async (route) => {
    const req = route.request();
    const url = req.url();
    const kind = hostKind(url);
    const fn = req.method() === 'POST' ? (() => { try { return JSON.parse(req.postData() ?? '{}').fn; } catch { return undefined; } })() : undefined;
    const record = { kind, url, method: req.method(), fn };
    net.all.push(record);
    if (kind === 'other') { net.leaks.push(url); return route.abort('failed'); }
    if (req.method() === 'OPTIONS') return net.mode === 'abort' ? route.abort('failed') : route.fulfill({ status: 204, headers: CORS });
    if (fn !== 'ping' && !url.includes('/health')) net.calls.push(record);
    if (net.mode === 'abort') return route.abort('failed');
    if (net.mode === '500' || net.mode === '429') {
      return route.fulfill({ status: Number(net.mode), contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: `E2E ${net.mode}` }) });
    }
    return route.fulfill({ status: 200, contentType: kind === 'img' ? 'image/gif' : 'application/json', headers: CORS, body: kind === 'img' ? '' : '{}' });
  });
  net.count = (pred) => net.calls.filter(pred).length;
  return net;
}

/** Echter Offline-Zustand: Browser meldet offline, jede externe Anfrage scheitert wie ohne Netz. */
async function goOffline(page, net) {
  net.mode = 'abort';
  // Kein context.setOffline: ohne Service Worker lud der Browser dann auch Lazy-Chunks der App nicht mehr (Testartefakt, in der nativen App liegen sie lokal).
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    window.dispatchEvent(new Event('offline'));
  });
}

// ---------------------------------------------------------------- Messungen

const sheetOpen = (page) => page.locator('ion-modal.show-modal').count().then((n) => n > 0);

/** Alles im Seiten- oder Sheet-Kontext (page.evaluate): Probleme zu Ueberlauf, Tippzielen, abgeschnittenem Text. */
function layoutProblems(page) {
  return page.evaluate(({ minTap }) => {
    const vw = window.innerWidth;
    const modal = [...document.querySelectorAll('ion-modal.show-modal')].at(-1);
    const root = modal ?? document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') ?? document.body;
    const problems = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
        if (n.classList?.contains('visually-hidden') || n.hasAttribute?.('hidden') || n.tagName === 'ION-ITEM-OPTIONS') return false;
      }
      return true;
    };
    const inHScroll = (el) => {
      for (let n = el.parentElement; n && n !== root; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) return true;
      }
      return false;
    };
    const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || ''} "${(el.textContent ?? '').trim().slice(0, 24)}"`;
    const over = document.documentElement.scrollWidth - vw;
    if (over > 0) problems.push(`Seite ${over}px zu breit`);
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el) || inHScroll(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) problems.push(`ragt heraus: ${label(el)} (${Math.round(r.left)}..${Math.round(r.right)} bei ${vw})`);
    }
    for (const b of root.querySelectorAll('button, ion-button, ion-segment-button, ion-item[button], ion-fab-button')) {
      if (!visible(b) || b.closest('ion-item-sliding ion-item-options')) continue;
      const r = b.getBoundingClientRect();
      // Bausteine wie der Stepper vergrößern die Tippfläche unsichtbar über ::before (negatives inset).
      const before = getComputedStyle(b, '::before');
      const grow = before.content !== 'none' && before.position === 'absolute' ? Math.max(0, -parseFloat(before.top) || 0) + Math.max(0, -parseFloat(before.bottom) || 0) : 0;
      if (r.height + grow < minTap) problems.push(`Tippziel ${Math.round(r.width)}x${Math.round(r.height)}: ${label(b)}`);
    }
    // Text innerhalb seines Elements bzw. des Bildschirms (keine Abschneidung rechts/unten bei overflow hidden).
    const textHosts = root.querySelectorAll('button, ion-button, ion-segment-button, [role="alert"], [role="status"], .scan-hint, .empty p, .empty h2, .form-error, p, h2, h3');
    for (const el of textHosts) {
      if (!visible(el) || !(el.textContent ?? '').trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const clipsX = cs.overflowX !== 'visible';
      const clipsY = cs.overflowY !== 'visible';
      if (t.right > vw + 1 || t.left < -1) problems.push(`Text ausserhalb des Bildschirms: ${label(el)}`);
      else if (clipsX && (t.right > r.right + 1.5 || t.left < r.left - 1.5)) problems.push(`Text abgeschnitten (waagrecht): ${label(el)}`);
      else if (clipsY && t.bottom > r.bottom + 1.5) problems.push(`Text abgeschnitten (senkrecht): ${label(el)}`);
      if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow === 'ellipsis' && !el.matches('ion-segment-button')) problems.push(`Text mit Auslassung gekuerzt: ${label(el)}`);
    }
    return [...new Set(problems)];
  }, { minTap: MIN_TAP_PX });
}

/** Sichtbarer Text des obersten Sheets bzw. der aktuellen Seite. */
function visibleText(page) {
  return page.evaluate(() => {
    const modal = [...document.querySelectorAll('ion-modal.show-modal')].at(-1);
    const root = modal ?? document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') ?? document.body;
    return root.innerText;
  });
}

const visibleSpinners = (page) => page.evaluate(() => {
  const modal = [...document.querySelectorAll('ion-modal.show-modal')].at(-1);
  const root = modal ?? document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') ?? document.body;
  return [...root.querySelectorAll('ion-spinner')].filter((s) => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
});

const isDisabled = (locator) => locator.evaluate((el) => el.disabled === true || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('button-disabled'));

async function shot(page, name, width) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}-${width}.png`) });
}

const noBadText = async (page, where) => {
  const text = await visibleText(page);
  const hit = text.match(BAD_TOKENS);
  assert.ok(!hit, `${where}: unzulaessiger Text "${hit?.[0]}" im sichtbaren Inhalt`);
  return text;
};

const closeTopSheet = async (page) => {
  await topModal(page).locator('ion-button.nt-sheet-close, [data-testid="add-close"]').first().click({ force: true });
  await settle(page, 600);
};

// ---------------------------------------------------------------- Zustand Leer

/** Je Tab: Route, Erwartungen mit Profil (leere Daten) bzw. ohne Profil. `controls` sind sichtbare naechste Schritte. */
const EMPTY_TABS = [
  {
    id: 'heute', route: 'dashboard',
    withProfile: { text: [/Noch nichts eingetragen/, /Essenszeiten/i], controls: ['.row__btn'] },
    noProfile: { text: [/Willkommen bei NutriTrack/, /Profil einrichten/], controls: ['ion-button:has-text("Profil einrichten")'] },
  },
  {
    id: 'tagebuch', route: 'diary',
    withProfile: { text: [/Noch nichts eingetragen/], controls: ['.meal__empty-add', '[data-testid="diary-add"]'] },
    noProfile: { text: [/Noch nichts eingetragen/], controls: ['.meal__empty-add', '[data-testid="diary-add"]'] },
  },
  {
    id: 'rezepte', route: 'recipes',
    withProfile: { text: [/Noch keine Rezepte/], controls: ['button:has-text("Rezept importieren")', 'ion-fab-button'] },
    noProfile: { text: [/Noch keine Rezepte/], controls: ['button:has-text("Rezept importieren")', 'ion-fab-button'] },
  },
  {
    id: 'einkauf', route: 'shopping', open: async (page) => { await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click(); await settle(page, 500); },
    withProfile: { text: [/Noch kein Wochenplan/], controls: ['[data-testid="week-plan-btn"]'] },
    noProfile: { text: [/Noch kein Wochenplan/], controls: ['[data-testid="week-plan-btn"]'] },
  },
  {
    id: 'einkauf-liste', route: 'shopping', open: async (page) => { await page.locator('ion-segment-button', { hasText: 'Liste' }).first().click(); await settle(page, 500); },
    withProfile: { text: [/Noch keine Liste/], controls: ['ion-button:has-text("Wochenplan erstellen")', 'ion-fab-button'] },
    noProfile: { text: [/Noch keine Liste/], controls: ['ion-button:has-text("Wochenplan erstellen")', 'ion-fab-button'] },
  },
  {
    id: 'profil', route: 'settings',
    withProfile: { text: [/Noch kein Gewicht eingetragen/], controls: ['[data-testid="weight-add"]', '[data-testid="open-profile"]'] },
    noProfile: { text: [/Einrichten/], controls: ['[data-testid="open-profile"]'] },
  },
];

async function assertEmptyState(page, tab, expect, label) {
  const text = await noBadText(page, label);
  for (const re of expect.text) assert.match(text, re, `${label}: erwarteter Hinweis ${re} fehlt`);
  assert.ok(text.replace(/\s+/g, ' ').trim().length >= 40, `${label}: fast leerer Bereich (${text.trim().length} Zeichen)`);
  const root = page.locator('ion-router-outlet .ion-page:not(.ion-page-hidden)');
  for (const sel of expect.controls) {
    assert.ok(await root.locator(sel).first().isVisible(), `${label}: naechster Schritt (${sel}) nicht sichtbar`);
  }
  const problems = await layoutProblems(page);
  assert.deepEqual(problems, [], `${label}: ${problems.join('; ')}`);
}

// ---------------------------------------------------------------- Zustand Fehler

const MODES = [
  { mode: '500', tag: 'fehler500', expect: /nicht erreichbar|nicht verfügbar|überlastet|antwortet gerade nicht|fehlgeschlagen/i, text: 'Serverfehler 500' },
  { mode: '429', tag: 'fehler429', expect: /Zu viele Anfragen/, text: 'Begrenzung 429' },
  { mode: 'abort', tag: 'abbruch', expect: /Internetverbindung|nicht erreichbar|nicht verfügbar|antwortet gerade nicht|fehlgeschlagen/i, text: 'Verbindungsabbruch' },
];
const isWorkerFn = (fn) => (c) => c.kind === 'worker' && c.fn === fn;
const isWorkerPath = (part) => (c) => c.kind === 'worker' && c.url.includes(part);

/** Wartet auf die sichtbare Fehlermeldung, liefert ihren Text. */
async function waitForAlert(scope, locator) {
  const el = locator.first();
  await el.waitFor({ state: 'visible', timeout: 12000 });
  return (await el.innerText()).trim();
}

/**
 * Ablauf je Funktion. open: oeffnet den Ausloeser, liefert den Bereich; trigger(attempt): loest die Anfrage aus;
 * alert: Locator der Fehlermeldung; busy: Text des Ladezustands; button: Locator der Ausloeser-Schaltflaeche (optional);
 * isCall: zaehlt die Anfragen dieser Funktion; noSuccess: prueft, dass nichts Erfolgreiches angezeigt/gespeichert wurde.
 */
const FUNCTIONS = [
  {
    id: 'lebensmittelsuche',
    isCall: isWorkerPath('/off-search'),
    async open(page) {
      await go(page, 'diary');
      await page.locator('[data-testid="diary-add"]').click();
      const modal = topModal(page);
      await modal.locator('ion-searchbar input').waitFor();
      await settle(page, 700);
      return modal;
    },
    trigger: (page, modal, n) => modal.locator('ion-searchbar input').fill(n === 1 ? 'haferflocken' : 'quark'),
    alert: (modal) => modal.locator('.scan-hint[role="alert"]'),
    busy: /Suche läuft/,
    button: (modal) => modal.locator('ion-searchbar input'),
    noSuccess: async (page, modal) => assert.equal(await modal.locator('ion-item[button] nt-food-row').count(), 0, 'Treffer trotz Fehler'),
  },
  {
    id: 'barcode-eingabe',
    isCall: (c) => c.kind === 'off' && c.url.includes('/api/v3/product/'),
    async open(page) {
      await go(page, 'diary');
      await page.locator('[data-testid="diary-add"]').click();
      await topModal(page).locator('.nt-source-btn', { hasText: 'Barcode' }).click();
      await settle(page, 1200);
      const scanner = topModal(page);
      await scanner.locator('ion-button', { hasText: 'Code eintippen' }).click({ force: true });
      await ionInput(scanner, 'Barcode').waitFor();
      return scanner;
    },
    trigger: async (page, scanner, n) => {
      await ionInput(scanner, 'Barcode').fill(n === 1 ? '4000417025005' : '4000417025006');
      await scanner.locator('ion-button', { hasText: /Nachschlagen/ }).click({ force: true });
    },
    alert: (scanner) => scanner.locator('.bc-error'),
    busy: /Produkt wird gesucht|Suche…/,
    button: (scanner) => scanner.locator('ion-button', { hasText: /Nachschlagen|Suche…/ }),
    noSuccess: async (page) => assert.equal(await page.locator('ion-modal.show-modal').count() >= 1, true, 'Scanner darf nicht schliessen'),
  },
  {
    id: 'rezept-onlinesuche',
    isCall: isWorkerPath('/recipes/complexSearch'),
    async open(page) {
      await go(page, 'recipes');
      await page.locator('[data-testid="online-search-btn"]').click();
      const modal = topModal(page);
      await modal.locator('.nt-sheet-header__title', { hasText: 'Rezepte online' }).waitFor();
      await settle(page, 500);
      return modal;
    },
    trigger: async (page, modal, n) => {
      await modal.locator('ion-input input[aria-label="Rezept suchen"]').fill(n === 1 ? 'lentil' : 'chicken');
      await modal.locator('.os-search-btn').click();
    },
    alert: (modal) => modal.locator('.os-error'),
    busy: /Suche läuft/,
    button: (modal) => modal.locator('.os-search-btn'),
    noSuccess: async (page, modal) => assert.equal(await modal.locator('.os-card').count(), 0, 'Rezepttreffer trotz Fehler'),
  },
  {
    id: 'wochenplan',
    isCall: isWorkerPath('/recipes/complexSearch'),
    async open(page) {
      await go(page, 'shopping');
      await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click();
      await settle(page, 500);
      return null;
    },
    trigger: (page) => page.locator('[data-testid="week-plan-btn"]').click(),
    alert: (scope, page) => page.locator('ion-router-outlet .ion-page:not(.ion-page-hidden) .form-error[role="alert"]'),
    busy: /Erstelle|Übersetze/,
    button: (scope, page) => page.locator('[data-testid="week-plan-btn"]'),
    noSuccess: async (page) => {
      assert.equal(await readStore(page, 'weekPlan'), null, 'Wochenplan trotz Fehler gespeichert');
      assert.equal(await page.locator('[data-testid="plan-summary"]').count(), 0, 'Plan-Zusammenfassung trotz Fehler');
    },
  },
  {
    id: 'fastfood',
    isCall: isWorkerFn('suggestFastfood'),
    async open(page) {
      await go(page, 'diary');
      await page.locator('.ff-btn').click();
      const modal = topModal(page);
      await modal.locator('[data-testid="ff-run"]').waitFor();
      await settle(page, 600);
      return modal;
    },
    trigger: (page, modal) => modal.locator('[data-testid="ff-run"]').click({ force: true }),
    alert: (modal) => modal.locator('.form-error[role="alert"]'),
    busy: /Suche \(bis zu 30 s\)/,
    button: (modal) => modal.locator('[data-testid="ff-run"]'),
    noSuccess: async (page, modal) => assert.equal(await modal.locator('.ff-card').count(), 0, 'Vorschlaege trotz Fehler'),
  },
  {
    id: 'einkaufsliste-ki',
    seed: () => seed({ recipes: [RECIPE] }),
    isCall: isWorkerFn('generateShoppingList'),
    async open(page) {
      await go(page, 'shopping');
      await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click();
      await settle(page, 500);
      await page.locator('[data-testid="own-recipes-toggle"]').click();
      await page.locator('[data-testid="own-plan-btn"]').waitFor();
      await settle(page, 400);
      return null;
    },
    trigger: (page) => page.locator('[data-testid="own-plan-btn"]').click(),
    alert: (scope, page) => page.locator('ion-router-outlet .ion-page:not(.ion-page-hidden) .form-error[role="alert"]'),
    busy: /Erstelle/,
    button: (scope, page) => page.locator('[data-testid="own-plan-btn"]'),
    noSuccess: async (page) => assert.equal(await readStore(page, 'shopping'), null, 'Einkaufsliste trotz Fehler gespeichert'),
  },
  ...['text', 'link'].map((kind) => ({
    id: `rezept-import-${kind}`,
    isCall: isWorkerFn('importRecipe'),
    async open(page) {
      await go(page, 'recipes');
      await page.locator('[data-testid="import-btn"]').click();
      const modal = topModal(page);
      await modal.locator('ion-textarea textarea').waitFor();
      await settle(page, 500);
      return modal;
    },
    trigger: async (page, modal) => {
      if (kind === 'text') await modal.locator('ion-textarea textarea').fill(IMPORT_TEXT);
      else {
        await modal.locator('ion-textarea textarea').fill('');
        await modal.locator('#import-url input').fill(IMPORT_URL);
      }
      await settle(page, 400);
      await eventually(async () => assert.equal(await isDisabled(modal.locator('.save-btn')), false, 'Importieren bleibt trotz Eingabe gesperrt'), 3000, 150);
      await modal.locator('.save-btn').click();
    },
    alert: (modal) => modal.locator('.form-error[role="alert"]'),
    busy: /Importiere…/,
    button: (modal) => modal.locator('.save-btn'),
    noSuccess: async (page) => {
      assert.deepEqual(await readStore(page, 'recipes'), [], 'Rezept trotz Fehler gespeichert');
      assert.equal(await page.locator('ion-modal.show-modal .nt-sheet-header__title', { hasText: /Neues Rezept|Rezept bearbeiten/ }).count(), 0, 'Rezeptformular trotz Fehler geoeffnet');
    },
  })),
];

async function runErrorCase(page, fn, mode, vp) {
  await page.setViewportSize(vp);
  const net = await installNet(page, 'ok');
  const scope = await fn.open(page);
  const where = `${fn.id} ${mode.mode} ${vp.width}px`;
  net.mode = mode.mode;
  const before = net.count(fn.isCall);
  await fn.trigger(page, scope, 1);
  const alertLoc = fn.alert(scope, page);
  const message = await waitForAlert(scope, alertLoc);
  assert.ok(net.count(fn.isCall) > before, `${where}: es ging keine Anfrage hinaus, Meldung "${message}" stammt nicht von der Funktion`);
  assert.match(message, mode.expect, `${where}: Meldung passt nicht zu "${mode.text}": "${message}"`);
  assert.ok(!TECHNICAL.test(message) && !BAD_TOKENS.test(message), `${where}: technischer Text in der Meldung: "${message}"`);
  assert.match(message, /[a-zäöü]{4}/i, `${where}: Meldung ist nicht lesbar`);

  // Kein dauerhafter Ladezustand, Schaltflaeche bedienbar.
  await eventually(async () => {
    assert.equal(await visibleSpinners(page), 0, `${where}: Ladekreisel haengt`);
    assert.doesNotMatch(await visibleText(page), fn.busy, `${where}: Ladetext haengt`);
  }, SPINNER_GONE_MS, 200);
  const button = fn.button(scope, page);
  await eventually(async () => assert.equal(await isDisabled(button), false, `${where}: Schaltflaeche bleibt gesperrt`), SPINNER_GONE_MS, 200);
  await fn.noSuccess(page, scope);
  assert.doesNotMatch(await page.locator('ion-toast').allInnerTexts().then((t) => t.join(' ')), SUCCESS_WORDS, `${where}: Erfolgsmeldung trotz Fehler`);
  const text = await noBadText(page, where);
  assert.ok(text.includes(message), `${where}: Meldung nicht im sichtbaren Bereich`);

  await settle(page, 300);
  await shot(page, fn.id, `${mode.tag}-${vp.width}`.replace(/^(.*)-(\d+)$/, '$1-$2')).catch(() => undefined);
  const problems = await layoutProblems(page);

  // Erneuter Versuch: zweite Anfrage geht hinaus und endet wieder in einer lesbaren Meldung.
  const calls = net.count(fn.isCall);
  await fn.trigger(page, scope, 2);
  await eventually(async () => assert.ok(net.count(fn.isCall) > calls, `${where}: erneuter Versuch sendet nichts`), 8000, 200);
  const again = await waitForAlert(scope, fn.alert(scope, page));
  assert.match(again, mode.expect, `${where}: Meldung nach erneutem Versuch: "${again}"`);
  await eventually(async () => assert.equal(await visibleSpinners(page), 0, `${where}: Ladekreisel nach 2. Versuch`), SPINNER_GONE_MS, 200);
  assert.deepEqual(net.leaks, [], `${where}: Anfragen an unbekannte Hosts: ${net.leaks}`);
  assert.deepEqual(problems, [], `${where}: ${problems.join('; ')}`);
}

// ---------------------------------------------------------------- Registrierung

export function register({ test }) {
  // ---- Leer: Tabs
  for (const vp of VIEWPORTS) {
    for (const tab of EMPTY_TABS) {
      for (const [key, state] of [['withProfile', 'leer'], ['noProfile', 'leer-ohne-profil']]) {
        test(`w5 leer ${tab.id} ${key === 'noProfile' ? 'ohne Profil' : 'mit Profil'} ${vp.width}px: Hinweis, naechster Schritt, kein Ueberlauf`,
          key === 'noProfile' ? withoutProfile() : seed(), async (page) => {
            await page.setViewportSize(vp);
            await installNet(page, 'ok');
            await go(page, tab.route);
            if (tab.open) await tab.open(page);
            await settle(page, 400);
            await shot(page, tab.id, `${state}-${vp.width}`);
            await assertEmptyState(page, tab, tab[key], `${tab.id} ${key}`);
          });
      }
    }
  }

  // ---- Leer: Sheets und Unteransichten
  const SHEETS = [
    ['eintragen', 'diary', (p) => p.locator('[data-testid="diary-add"]').click(), /Suche oder scanne ein Lebensmittel/],
    ['fastfood', 'diary', (p) => p.locator('.ff-btn').click(), /Vorschläge/],
    ['rezept-import', 'recipes', (p) => p.locator('[data-testid="import-btn"]').click(), /Rezept-Text/],
    ['online-suche', 'recipes', (p) => p.locator('[data-testid="online-search-btn"]').click(), /Rezepte|Suchen/],
    ['rezept-neu', 'recipes', (p) => p.getByRole('button', { name: 'Neues Rezept' }).click(), /Neues Rezept/],
    ['mahlzeit-neu', 'recipes', async (p) => {
      await p.locator('ion-segment-button', { hasText: 'Mahlzeiten' }).click();
      await settle(p, 400);
      await p.getByRole('button', { name: 'Neue Mahlzeit' }).click();
    }, /Mahlzeit anlegen/],
    ['gewicht', 'settings', (p) => p.locator('[data-testid="weight-add"]').click(), /Gewicht eintragen/],
    ['artikel', 'shopping', (p) => p.locator('ion-fab-button').click(), /Artikel/],
  ];
  for (const vp of VIEWPORTS) {
    for (const [id, route, open, expectText] of SHEETS) {
      test(`w5 leer sheet ${id} ${vp.width}px: lesbar, kein Ueberlauf, Tippziele`, seed(), async (page) => {
        await page.setViewportSize(vp);
        await installNet(page, 'ok');
        await go(page, route);
        await open(page);
        await page.locator('ion-modal.show-modal').last().waitFor();
        await settle(page, 1000);
        await shot(page, `sheet-${id}`, `leer-${vp.width}`);
        const text = await noBadText(page, id);
        assert.match(text, expectText, `${id}: erwarteter Text fehlt`);
        const problems = await layoutProblems(page);
        assert.deepEqual(problems, [], `${id}: ${problems.join('; ')}`);
      });
    }
    test(`w5 leer mahlzeiten-liste ${vp.width}px: Hinweis und naechster Schritt`, seed(), async (page) => {
      await page.setViewportSize(vp);
      await installNet(page, 'ok');
      await go(page, 'recipes');
      await page.locator('ion-segment-button', { hasText: 'Mahlzeiten' }).click();
      await settle(page, 600);
      await shot(page, 'mahlzeiten', `leer-${vp.width}`);
      const text = await noBadText(page, 'mahlzeiten');
      assert.match(text, /Noch keine Mahlzeiten/);
      assert.ok(await page.locator('ion-fab-button').isVisible(), 'kein Weg zur ersten Mahlzeit');
      const problems = await layoutProblems(page);
      assert.deepEqual(problems, [], problems.join('; '));
    });
    test(`w5 leer tagebuch-woche ${vp.width}px: Platzhalter statt Zahlen, kein NaN`, seed(), async (page) => {
      await page.setViewportSize(vp);
      await installNet(page, 'ok');
      await go(page, 'diary');
      await page.locator('ion-segment-button', { hasText: 'Woche' }).click();
      await page.locator('[data-testid="week-view"]').waitFor();
      await settle(page, 600);
      await shot(page, 'tagebuch-woche', `leer-${vp.width}`);
      await noBadText(page, 'woche');
      const problems = await layoutProblems(page);
      assert.deepEqual(problems, [], problems.join('; '));
    });
    test(`w5 leer einkauf eigene Rezepte ohne Rezepte ${vp.width}px: Hinweis statt leerer KI-Anfrage`, seed(), async (page) => {
      await page.setViewportSize(vp);
      const net = await installNet(page, 'ok');
      await go(page, 'shopping');
      await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click();
      await page.locator('[data-testid="own-recipes-toggle"]').click();
      await settle(page, 600);
      await shot(page, 'einkauf-eigene-rezepte', `leer-${vp.width}`);
      const btn = page.locator('[data-testid="own-plan-btn"]');
      const hint = /Lege zuerst eigene Rezepte an/.test(await visibleText(page));
      const blocked = await isDisabled(btn);
      if (!hint || !blocked) {
        await btn.click({ force: true });
        await settle(page, 1200);
      }
      assert.ok(hint && blocked, `Ohne Rezepte fehlt Hinweis (${hint}) oder Sperre (${blocked}); KI-Anfragen: ${net.count(isWorkerFn('generateShoppingList'))}`);
      const problems = await layoutProblems(page);
      assert.deepEqual(problems, [], problems.join('; '));
    });
    test(`w5 leer profil-sheet ohne Profil ${vp.width}px: lesbar, kein Ueberlauf`, withoutProfile(), async (page) => {
      await page.setViewportSize(vp);
      await installNet(page, 'ok');
      await go(page, 'settings');
      await page.locator('[data-testid="open-profile"]').click();
      await page.locator('ion-modal.show-modal').last().waitFor();
      await settle(page, 1000);
      await shot(page, 'sheet-profil', `leer-${vp.width}`);
      await noBadText(page, 'profil-sheet');
      const problems = await layoutProblems(page);
      assert.deepEqual(problems, [], problems.join('; '));
    });
  }

  // ---- Fehler
  for (const fn of FUNCTIONS) {
    for (const mode of MODES) {
      for (const vp of VIEWPORTS) {
        test(`w5 fehler ${fn.id} ${mode.mode} ${vp.width}px: deutsche Meldung, kein Spinner, erneut moeglich`,
          fn.seed ? fn.seed() : seed(), (page) => runErrorCase(page, fn, mode, vp));
      }
    }
  }

  // ---- Offline: lokale Funktionen
  for (const vp of VIEWPORTS) {
    test(`w5 offline ${vp.width}px: alle Tabs bedienbar, ohne Ueberlauf, Seiten zeigen Inhalt`, seed({ diary: DIARY_NORMAL, recipes: [RECIPE], shopping: SHOPPING }), async (page) => {
      await page.setViewportSize(vp);
      const net = await installNet(page, 'ok');
      await go(page, 'dashboard');
      await goOffline(page, net);
      for (const [tab, route, expectText] of [
        ['heute', 'dashboard', /kcal/], ['tagebuch', 'diary', /Linsencurry/], ['rezepte', 'recipes', /Linsentopf/],
        ['einkauf', 'shopping', /Rote Linsen|Wochenplan/], ['profil', 'settings', /Mein Profil/],
      ]) {
        await page.locator(`ion-tab-button[tab="${route}"]`).click();
        await settle(page, 700);
        await shot(page, tab, `offline-${vp.width}`);
        const text = await noBadText(page, `offline ${tab}`);
        assert.match(text, expectText, `offline ${tab}: Inhalt fehlt`);
        const problems = await layoutProblems(page);
        assert.deepEqual(problems, [], `offline ${tab}: ${problems.join('; ')}`);
      }
      assert.deepEqual(net.leaks, []);
    });

    test(`w5 offline ${vp.width}px: Schnell-Eintrag ins Tagebuch funktioniert lokal`, seed(), async (page) => {
      await page.setViewportSize(vp);
      const net = await installNet(page, 'ok');
      await go(page, 'diary');
      await goOffline(page, net);
      await page.locator('[data-testid="diary-add"]').click();
      const modal = topModal(page);
      await modal.locator('.nt-source-btn', { hasText: 'Manuell' }).click();
      await ionInput(modal, 'Name').fill('Offline Brot');
      await amountInput(modal, 'Menge (optional)').fill('80');
      await ionInput(modal, 'Kalorien (kcal)').fill('210');
      await shot(page, 'eintragen', `offline-${vp.width}`);
      await modal.locator('.add-footer__save').click();
      await settle(page, 700);
      const stored = (await readStore(page, 'diary')).find((e) => e.label === 'Offline Brot');
      assert.ok(stored, 'Eintrag offline nicht gespeichert');
      assert.equal(stored.facts.kcal, 210);
      assert.deepEqual(net.calls, [], 'lokaler Eintrag darf keine Anfrage ausloesen');
    });

    test(`w5 offline ${vp.width}px: eigenes Rezept anlegen funktioniert lokal`, seed(), async (page) => {
      await page.setViewportSize(vp);
      const net = await installNet(page, 'ok');
      await go(page, 'recipes');
      await goOffline(page, net);
      await page.getByRole('button', { name: 'Neues Rezept' }).click();
      const modal = topModal(page);
      await modal.locator('.nt-sheet-header__title', { hasText: 'Neues Rezept' }).waitFor();
      await modal.locator('ion-input input[aria-label="Name"]').fill('Offline Suppe');
      await modal.locator('ion-input input[aria-label="Name"]').press('Tab');
      await modal.locator('.nt-add-btn', { hasText: 'manuelle Zutat' }).click();
      const ingredient = modal.locator('ion-input input[aria-label="Zutatname"]');
      await ingredient.fill('Karotten');
      await ingredient.press('Tab');
      await amountInput(modal, 'Menge').first().fill('300');
      await shot(page, 'rezept-neu', `offline-${vp.width}`);
      await modal.locator('.save-btn').click();
      await settle(page, 800);
      const recipe = (await readStore(page, 'recipes')).find((r) => r.title === 'Offline Suppe');
      assert.ok(recipe, 'Rezept offline nicht gespeichert');
      assert.deepEqual(net.calls, [], 'Rezept anlegen darf keine Anfrage ausloesen');
    });

    test(`w5 offline ${vp.width}px: Einkaufsliste abhaken funktioniert lokal`, seed({ shopping: SHOPPING }), async (page) => {
      await page.setViewportSize(vp);
      const net = await installNet(page, 'ok');
      await go(page, 'shopping');
      await page.locator('ion-segment-button', { hasText: 'Liste' }).first().click();
      await page.locator('.check-row__name', { hasText: 'Rote Linsen' }).waitFor();
      await goOffline(page, net);
      await page.locator('ion-checkbox', { hasText: 'Rote Linsen' }).click({ position: { x: 14, y: 14 } });
      await eventually(async () => {
        const list = await readStore(page, 'shopping');
        assert.equal(list.items.find((i) => i.name === 'Rote Linsen').checked, true, 'Haken nicht gespeichert');
      });
      await shot(page, 'einkauf-liste', `offline-${vp.width}`);
      const problems = await layoutProblems(page);
      assert.deepEqual(problems, [], problems.join('; '));
      assert.deepEqual(net.calls, []);
    });

    // ---- Offline: Online-Funktionen zeigen einen Hinweis statt zu haengen
    for (const fn of FUNCTIONS.filter((f) => ['lebensmittelsuche', 'rezept-onlinesuche', 'wochenplan', 'fastfood', 'einkaufsliste-ki', 'rezept-import-text'].includes(f.id))) {
      test(`w5 offline ${vp.width}px: ${fn.id} meldet fehlende Verbindung statt zu haengen`, fn.seed ? fn.seed() : seed(), async (page) => {
        await page.setViewportSize(vp);
        const net = await installNet(page, 'ok');
        const scope = await fn.open(page);
        await goOffline(page, net);
        await fn.trigger(page, scope, 1);
        const message = await waitForAlert(scope, fn.alert(scope, page));
        assert.match(message, /Internetverbindung|nicht erreichbar|nicht verfügbar/i, `Offline-Meldung unklar: "${message}"`);
        assert.ok(!TECHNICAL.test(message), `technischer Text: "${message}"`);
        await eventually(async () => assert.equal(await visibleSpinners(page), 0, 'Ladekreisel haengt offline'), SPINNER_GONE_MS, 200);
        await eventually(async () => assert.equal(await isDisabled(fn.button(scope, page)), false, 'Schaltflaeche offline gesperrt'), SPINNER_GONE_MS, 200);
        await shot(page, fn.id, `offline-${vp.width}`);
        const problems = await layoutProblems(page);
        assert.deepEqual(problems, [], problems.join('; '));
      });
    }
  }

  // ---- Dichtheit: kein Test erreicht echte Dienste
  test('w5 netz: ein Rundgang durch alle Tabs spricht nur abgefangene Dienste an', seed({ diary: DIARY_NORMAL }), async (page) => {
    const net = await installNet(page, '500');
    for (const route of ['dashboard', 'diary', 'recipes', 'shopping', 'settings']) await go(page, route);
    assert.deepEqual(net.leaks, [], `unerwartete Hosts: ${net.leaks}`);
    assert.ok(BASE_URL.startsWith('http://localhost') || BASE_URL.startsWith('http://127.0.0.1'), 'E2E_BASE_URL muss lokal sein');
  });
}

export { PROFILE };
