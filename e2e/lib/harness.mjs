// E2E-Harness: Browser-Start, Seeding über localStorage, Mini-Testrunner mit Fehler-Screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACTS = path.resolve(here, '..', 'artifacts');
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4300';
export const STORAGE_PREFIX = 'nutritrack:';
const DEFAULT_TIMEOUT_MS = 6000;
const SETTLE_MS = 600;

// iPhone-Viewport (375 x 812), deutsches Locale
const CONTEXT_OPTIONS = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-AT',
};

/** Lädt Playwright aus dem Repo oder aus NT_PLAYWRIGHT_DIR (Ordner mit node_modules/playwright). */
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const dir = process.env.NT_PLAYWRIGHT_DIR;
    if (!dir) throw new Error('playwright nicht gefunden — devDependency installieren oder NT_PLAYWRIGHT_DIR setzen.');
    const require = createRequire(pathToFileURL(path.join(dir, 'package.json')));
    return require('playwright');
  }
}

/** Startet Chromium (lokale ms-playwright-Installation, sonst Standard, sonst Edge). */
export async function launchBrowser() {
  const { chromium } = await loadPlaywright();
  const exe = process.env.CHROMIUM_PATH
    ?? path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');
  const attempts = [
    () => (fs.existsSync(exe) ? chromium.launch({ headless: true, executablePath: exe }) : Promise.reject(new Error('no exe'))),
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ headless: true, channel: 'msedge' }),
  ];
  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/** Neuer, isolierter Kontext; `seed` (Key → Wert) wird einmalig vor dem ersten Laden geschrieben. */
export async function newPage(browser, seed = null) {
  const ctx = await browser.newContext(CONTEXT_OPTIONS);
  // E2E darf nie den echten globalen KI-Worker erreichen: jede Anfrage wird lokal mit 503 beantwortet.
  await ctx.route('https://*.workers.dev/**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: '{"error":"E2E: KI-Worker gesperrt"}',
  }));
  if (seed) {
    await ctx.addInitScript(([prefix, data]) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(data)) localStorage.setItem(prefix + k, JSON.stringify(v));
    }, [STORAGE_PREFIX, seed]);
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  return { ctx, page, consoleErrors };
}

export async function go(page, route) {
  await page.goto(`${BASE_URL}/${route}`, { waitUntil: 'load' });
  await page.locator('ion-router-outlet .ion-page:not(.ion-page-hidden)').first().waitFor();
  await page.waitForTimeout(SETTLE_MS);
}

export const settle = (page, ms = SETTLE_MS) => page.waitForTimeout(ms);

/** Liest einen gespeicherten Store-Wert (JSON) aus localStorage. */
export function readStore(page, key) {
  return page.evaluate(([k]) => JSON.parse(localStorage.getItem(k) ?? 'null'), [STORAGE_PREFIX + key]);
}

/** Wartet, bis `fn` ohne Assertion-Fehler durchläuft (für asynchrone UI-Updates). */
export async function eventually(fn, timeoutMs = 3000, stepMs = 150) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (Date.now() > end) throw e;
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }
}

export { assert };

/** Minimaler Runner: jeder Test bekommt eine frische Seite; bei Fehler Screenshot nach e2e/artifacts/. */
export function createRunner(browser) {
  const results = [];
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  async function test(name, seed, fn) {
    const { ctx, page, consoleErrors } = await newPage(browser, seed);
    const started = Date.now();
    try {
      await fn(page);
      results.push({ name, ok: true, ms: Date.now() - started });
      console.log(`PASS  ${name}`);
    } catch (e) {
      const file = path.join(ARTIFACTS, `${name.replace(/[^\w-]+/g, '_')}.png`);
      await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
      const message = String(e?.message ?? e).split('\n').slice(0, 12).join(' | ');
      results.push({ name, ok: false, ms: Date.now() - started, message, screenshot: file, consoleErrors });
      console.log(`FAIL  ${name}\n      ${message}\n      screenshot: ${file}`);
    } finally {
      await ctx.close();
    }
  }

  return { test, results };
}
