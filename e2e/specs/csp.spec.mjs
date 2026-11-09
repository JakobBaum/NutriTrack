// CSP: Die App darf unter ihrer Meta-CSP weder Verstoesse melden noch Tesseract (Blob-Worker + WASM) brechen.
import { assert, go } from '../lib/harness.mjs';

const CORE_FILE = 'assets/tesseract/core/tesseract-core-simd-lstm.wasm.js';
const WORKER_FILE = 'assets/tesseract/worker.min.js';
const WORKER_TIMEOUT_MS = 20000;

/** Startet wie tesseract.js einen Blob-Worker, laedt den Core und wartet auf die WASM-Initialisierung. */
function spawnOcrCoreInBlobWorker([coreFile, workerFile, timeoutMs]) {
  const base = document.baseURI;
  const coreUrl = new URL(coreFile, base).href;
  const workerUrl = new URL(workerFile, base).href;
  const source = `importScripts(${JSON.stringify(workerUrl)});`
    + `importScripts(${JSON.stringify(coreUrl)});`
    + 'TesseractCore({}).then(() => postMessage("ok"), (e) => postMessage("error: " + e));';
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
  return new Promise((resolve) => {
    const worker = new Worker(blobUrl);
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    worker.onmessage = (e) => { clearTimeout(timer); resolve(String(e.data)); };
    worker.onerror = (e) => { clearTimeout(timer); resolve('worker-error: ' + (e.message || 'unbekannt')); };
  });
}

export function register({ test }) {
  test('csp: Seite meldet keine CSP-Verstoesse beim Laden', null, async (page) => {
    const violations = [];
    await page.exposeFunction('reportViolation', (text) => violations.push(text));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        window.reportViolation(`${e.violatedDirective} -> ${e.blockedURI}`);
      });
    });
    for (const route of ['dashboard', 'diary', 'recipes', 'shopping', 'settings']) await go(page, route);
    assert.deepEqual(violations, [], `CSP-Verstoesse: ${violations.join(', ')}`);
  });

  test('csp: Tesseract-Core laeuft im Blob-Worker unter der Seiten-CSP', null, async (page) => {
    await go(page, 'dashboard');
    const result = await page.evaluate(spawnOcrCoreInBlobWorker, [CORE_FILE, WORKER_FILE, WORKER_TIMEOUT_MS]);
    assert.equal(result, 'ok');
  });
}
