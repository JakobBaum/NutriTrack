// Tests für den Cloudflare-Worker (worker.js) — laufen mit `node --test worker.test.mjs`.
// Upstream-Aufrufe (OpenFoodFacts, Gemini, Rezeptseiten) werden über globalThis.fetch gemockt.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const BASE = 'https://nutritrack.example.workers.dev';
const APP_ORIGIN = 'https://jakobbaum.github.io';
const ENV = { GEMINI_API_KEY: 'test-key' };

const realFetch = globalThis.fetch;
let upstream = [];

function mockFetch(handler) {
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    upstream.push({ url, init });
    return handler(url, init);
  };
}

function geminiReply(obj) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function post(body, { origin = APP_ORIGIN, headers = {} } = {}) {
  return new Request(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function get(path, { origin = APP_ORIGIN } = {}) {
  return new Request(`${BASE}${path}`, { headers: origin ? { Origin: origin } : {} });
}

const PROFILE = {
  weightKg: 80, heightCm: 180, age: 30, sex: 'male',
  activityLevel: 'moderate', goal: 'lose', rateKgPerWeek: 0.5,
};

beforeEach(() => {
  upstream = [];
  // Standard: jeder nicht explizit gemockte Upstream-Call ist ein Testfehler (nie echt ins Netz).
  mockFetch((url) => { throw new Error(`unerwarteter Upstream-Call: ${url}`); });
});
afterEach(() => { globalThis.fetch = realFetch; });

describe('CORS', () => {
  it('beantwortet den Preflight erlaubter Origins inkl. User-Agent-Header (alte Clients/Safari)', async () => {
    // Act
    const res = await worker.fetch(new Request(`${BASE}/off-search?q=milch`, {
      method: 'OPTIONS',
      headers: { Origin: APP_ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'user-agent' },
    }), ENV);

    // Assert
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
    assert.match(res.headers.get('Access-Control-Allow-Headers'), /user-agent/i);
    assert.ok(Number(res.headers.get('Access-Control-Max-Age')) > 0);
  });

  it('weist fremde Origins ab', async () => {
    // Arrange
    mockFetch(() => new Response('{}'));

    // Act
    const res = await worker.fetch(get('/off-search?q=milch', { origin: 'https://evil.example' }), ENV);

    // Assert
    assert.equal(res.status, 403);
    assert.equal(upstream.length, 0);
  });

  it('akzeptiert per ALLOWED_ORIGINS konfigurierte Origins', async () => {
    // Arrange
    mockFetch(() => new Response('{"hits":[]}'));

    // Act
    const res = await worker.fetch(get('/off-search?q=milch', { origin: 'https://nutri.example' }),
      { ...ENV, ALLOWED_ORIGINS: 'https://nutri.example' });

    // Assert
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://nutri.example');
  });
});

describe('GET /off-search', () => {
  it('leitet nur erlaubte Parameter weiter, begrenzt page_size und setzt den OFF-User-Agent', async () => {
    // Arrange
    mockFetch(() => new Response('{"hits":[]}', { status: 200 }));

    // Act
    const res = await worker.fetch(get('/off-search?q=milch&page_size=500&langs=de&evil=1&fields=code'), ENV);

    // Assert
    assert.equal(res.status, 200);
    const target = new URL(upstream[0].url);
    assert.equal(target.origin + target.pathname, 'https://search.openfoodfacts.org/search');
    assert.equal(target.searchParams.get('q'), 'milch');
    assert.equal(target.searchParams.get('page_size'), '50');
    assert.equal(target.searchParams.get('evil'), null);
    assert.match(new Headers(upstream[0].init.headers).get('User-Agent'), /^NutriTrack\//);
  });

  it('lehnt fehlende oder zu lange Suchbegriffe ab', async () => {
    // Arrange
    mockFetch(() => new Response('{}'));

    // Act
    const missing = await worker.fetch(get('/off-search?page_size=5'), ENV);
    const tooLong = await worker.fetch(get(`/off-search?q=${'a'.repeat(300)}`), ENV);

    // Assert
    assert.equal(missing.status, 400);
    assert.equal(tooLong.status, 400);
    assert.equal(upstream.length, 0);
  });

  it('reicht ein OFF-Rate-Limit (429) mit CORS-Headern durch, damit die App es anzeigen kann', async () => {
    // Arrange
    mockFetch(() => new Response('slow down', { status: 429, headers: { 'Retry-After': '30' } }));

    // Act
    const res = await worker.fetch(get('/off-search?q=milch'), ENV);

    // Assert
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
    assert.equal(res.headers.get('Retry-After'), '30');
  });

  it('funktioniert ohne Origin-Header (native App / curl)', async () => {
    // Arrange
    mockFetch(() => new Response('{"hits":[]}'));

    // Act
    const res = await worker.fetch(get('/off-search?q=milch', { origin: null }), ENV);

    // Assert
    assert.equal(res.status, 200);
  });
});

describe('POST / (KI-Proxy)', () => {
  it('lehnt unbekannte Funktionen und kaputtes JSON ab', async () => {
    // Act
    const unknown = await worker.fetch(post({ fn: 'deleteEverything', payload: {} }), ENV);
    const broken = await worker.fetch(post('{nope'), ENV);

    // Assert
    assert.equal(unknown.status, 400);
    assert.equal(broken.status, 400);
  });

  it('lehnt zu große Bodies ab (Kostenschutz)', async () => {
    // Act
    const res = await worker.fetch(post({ fn: 'importRecipe', payload: { text: 'x'.repeat(11 * 1024 * 1024) } }), ENV);

    // Assert
    assert.equal(res.status, 413);
  });

  it('validiert Eingaben, bevor Gemini aufgerufen wird', async () => {
    // Arrange
    mockFetch(() => geminiReply({}));

    // Act
    const res = await worker.fetch(post({ fn: 'computeTargets', payload: { ...PROFILE, weightKg: -5 } }), ENV);

    // Assert
    assert.equal(res.status, 400);
    assert.equal(upstream.length, 0);
  });

  it('meldet fehlenden Server-Key als 503 ohne Upstream-Call', async () => {
    // Arrange
    mockFetch(() => geminiReply({}));

    // Act
    const res = await worker.fetch(post({ fn: 'computeTargets', payload: PROFILE }), {});

    // Assert
    assert.equal(res.status, 503);
    assert.equal(upstream.length, 0);
  });

  it('greift mit Rate-Limit-Binding und liefert 429', async () => {
    // Arrange
    mockFetch(() => geminiReply({}));
    const env = { ...ENV, AI_LIMITER: { limit: async () => ({ success: false }) } };

    // Act
    const res = await worker.fetch(post({ fn: 'computeTargets', payload: PROFILE }), env);

    // Assert
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
  });

  it('sendet den Gemini-Key als Header statt in der URL', async () => {
    // Arrange
    mockFetch(() => geminiReply({ kcal: 2200, proteinG: 160, carbsG: 220, fatG: 70, fiberG: 30, sugarG: 50 }));

    // Act
    const res = await worker.fetch(post({ fn: 'computeTargets', payload: PROFILE }), ENV);

    // Assert
    assert.equal(res.status, 200);
    assert.equal((await res.json()).kcal, 2200);
    assert.ok(!upstream[0].url.includes('test-key'));
    assert.equal(new Headers(upstream[0].init.headers).get('x-goog-api-key'), 'test-key');
  });
});

describe('POST / — Gemini überlastet (Retry, Fallback, 503)', () => {
  const realSetTimeout = globalThis.setTimeout;
  const errReply = (status) =>
    new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status });
  const run = () => worker.fetch(post({ fn: 'computeTargets', payload: PROFILE }), ENV);
  const OK = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30, sugarG: 40 };

  beforeEach(() => {
    // Backoff-Pausen überspringen, Timeouts der Fetch-Signale bleiben unberührt (unref'd intern).
    globalThis.setTimeout = (fn, _ms, ...a) => realSetTimeout(fn, 0, ...a);
  });
  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  it('wiederholt ein 503 und liefert danach das Ergebnis', async () => {
    let n = 0;
    mockFetch(() => (++n < 2 ? errReply(503) : geminiReply(OK)));
    const res = await run();
    assert.equal(res.status, 200);
    assert.equal(upstream.length, 2);
    assert.ok(upstream.every((u) => u.url.includes('gemini-3.6-flash:')));
  });

  it('fällt nach erschöpften Retries auf das Fallback-Modell zurück', async () => {
    mockFetch((url) => (url.includes('flash-lite') ? geminiReply(OK) : errReply(503)));
    const res = await run();
    assert.equal(res.status, 200);
    assert.equal(upstream.length, 3);
    assert.ok(upstream[2].url.includes('gemini-3.5-flash-lite:'));
  });

  it('antwortet 503 mit deutscher Meldung und Retry-After, wenn alles überlastet ist', async () => {
    mockFetch(() => errReply(503));
    const res = await run();
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('Retry-After'), '60');
    assert.match((await res.json()).error, /überlastet/);
    assert.equal(upstream.length, 4);
  });

  it('wiederholt 429 und 500 ebenfalls', async () => {
    let n = 0;
    mockFetch(() => (++n === 1 ? errReply(429) : ++n === 3 ? errReply(500) : geminiReply(OK)));
    const res = await run();
    assert.equal(res.status, 200);
  });

  it('wiederholt keine permanenten Fehler (400) und gibt 500 zurück', async () => {
    mockFetch(() => errReply(400));
    const res = await run();
    assert.equal(res.status, 500);
    assert.equal(upstream.length, 1);
  });
});

describe('importRecipe — SSRF-Schutz und Seitentext', () => {
  for (const url of ['http://localhost/admin', 'http://127.0.0.1:8080/', 'http://10.0.0.5/', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'http://[::1]/']) {
    it(`blockiert interne/unsichere URL ${url}`, async () => {
      // Arrange
      mockFetch(() => geminiReply({}));

      // Act
      const res = await worker.fetch(post({ fn: 'importRecipe', payload: { url } }), ENV);

      // Assert
      assert.equal(res.status, 400);
      assert.equal(upstream.length, 0);
    });
  }

  it('nutzt schema.org-JSON-LD der Rezeptseite statt Script-Müll', async () => {
    // Arrange
    const page = `<html><head><script>var tracking = "MUELL";</script>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
      {"@type":"Recipe","name":"Linsensuppe","recipeIngredient":["200 g Linsen"]}]}</script></head><body>Text</body></html>`;
    mockFetch((url) => url.startsWith('https://rezepte.example')
      ? new Response(page, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      : geminiReply({ title: 'Linsensuppe', servings: 2, ingredients: [], steps: [] }));

    // Act
    const res = await worker.fetch(post({ fn: 'importRecipe', payload: { url: 'https://rezepte.example/linsen' } }), ENV);

    // Assert
    assert.equal(res.status, 200);
    const prompt = JSON.parse(upstream[1].init.body).contents[0].parts.at(-1).text;
    assert.match(prompt, /Linsensuppe/);
    assert.match(prompt, /200 g Linsen/);
    assert.doesNotMatch(prompt, /MUELL/);
  });
});

describe('GET /health und Modellwechsel', () => {
  const OK = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30, sugarG: 40 };
  const run = () => worker.fetch(post({ fn: 'computeTargets', payload: PROFILE }), ENV);

  it('meldet Status ohne Key-Wert', async () => {
    const res = await worker.fetch(get('/health'), ENV);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
    const body = await res.json();
    assert.deepEqual(body, { ok: true, hasKey: true, model: 'gemini-3.6-flash', fallbackModel: 'gemini-3.5-flash-lite' });
    assert.ok(!JSON.stringify(body).includes('test-key'));
  });

  it('meldet hasKey=false ohne Secret und respektiert Modell-Overrides', async () => {
    const res = await worker.fetch(get('/health'), { GEMINI_MODEL: 'm1', GEMINI_FALLBACK_MODEL: 'm2' });
    assert.deepEqual(await res.json(), { ok: true, hasKey: false, model: 'm1', fallbackModel: 'm2' });
  });

  it('wechselt bei 404 (Modell unbekannt) sofort auf das Fallback-Modell', async () => {
    mockFetch((url) => (url.includes('flash-lite')
      ? geminiReply(OK)
      : new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })));
    const res = await run();
    assert.equal(res.status, 200);
    assert.equal(upstream.length, 2);
    assert.ok(upstream[1].url.includes('gemini-3.5-flash-lite:'));
  });

  it('wechselt bei 400 mit "model" im Text auf das Fallback-Modell', async () => {
    mockFetch((url) => (url.includes('flash-lite')
      ? geminiReply(OK)
      : new Response(JSON.stringify({ error: { message: 'Invalid model name' } }), { status: 400 })));
    const res = await run();
    assert.equal(res.status, 200);
    assert.equal(upstream.length, 2);
  });
});
