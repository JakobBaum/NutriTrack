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

const FASTFOOD = { restaurant: 'Burger', kcalBudget: 600 };

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
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: { ...FASTFOOD, kcalBudget: -5 } }), ENV);

    // Assert
    assert.equal(res.status, 400);
    assert.equal(upstream.length, 0);
  });

  it('meldet fehlenden Server-Key als 503 ohne Upstream-Call', async () => {
    // Arrange
    mockFetch(() => geminiReply({}));

    // Act
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), {});

    // Assert
    assert.equal(res.status, 503);
    assert.equal(upstream.length, 0);
  });

  it('greift mit Rate-Limit-Binding und liefert 429', async () => {
    // Arrange
    mockFetch(() => geminiReply({}));
    const env = { ...ENV, AI_LIMITER: { limit: async () => ({ success: false }) } };

    // Act
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), env);

    // Assert
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
  });

  it('sendet den Gemini-Key als Header statt in der URL', async () => {
    // Arrange
    mockFetch(() => geminiReply({ kcal: 2200, proteinG: 160, carbsG: 220, fatG: 70, fiberG: 30, sugarG: 50 }));

    // Act
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);

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
  const run = () => worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);
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

  it('gibt keine Upstream-Details an den Client (SEC-04)', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: { message: 'API key abc-SECRET invalid' } }), { status: 400 }));
    const res = await run();
    const text = await res.text();
    assert.equal(res.status, 500);
    assert.doesNotMatch(text, /SECRET|Gemini 400/);
  });
});

describe('importRecipe — SSRF-Schutz und Seitentext', () => {
  for (const url of ['http://localhost/admin', 'http://127.0.0.1:8080/', 'http://10.0.0.5/', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'http://[::1]/',
    'http://localhost./admin', 'http://127.0.0.1./', 'http://foo.localhost./', 'http://[::ffff:127.0.0.1]/',
    'http://[fd00::1]/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'http://example.com:8080/', 'http://example.com:22/',
    'http://192.168.1.1:443/', 'http://198.18.0.1/']) {
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
  const run = () => worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);

  it('meldet Status ohne Key-Wert', async () => {
    const res = await worker.fetch(get('/health'), ENV);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
    const body = await res.json();
    assert.deepEqual(body, {
      ok: true, hasKey: true, hasRecipeKey: false, hasRateLimiter: false, hasDailyCap: false,
      warning: 'Kein Tageslimit aktiv (KV-Binding DAILY_KV fehlt).',
      model: 'gemini-3.6-flash', fallbackModel: 'gemini-3.5-flash-lite',
    });
    assert.ok(!JSON.stringify(body).includes('test-key'));
  });

  it('meldet hasKey=false ohne Secret und respektiert Modell-Overrides', async () => {
    const res = await worker.fetch(get('/health'), { GEMINI_MODEL: 'm1', GEMINI_FALLBACK_MODEL: 'm2' });
    assert.deepEqual(await res.json(), {
      ok: true, hasKey: false, hasRecipeKey: false, hasRateLimiter: false, hasDailyCap: false,
      warning: 'Kein Tageslimit aktiv (KV-Binding DAILY_KV fehlt).',
      model: 'm1', fallbackModel: 'm2',
    });
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

describe('GET /recipes/complexSearch (spoonacular)', () => {
  const RECIPE_ENV = { ...ENV, SPOONACULAR_API_KEY: 'spoon-secret' };
  const okReply = () => new Response('{"results":[],"totalResults":0}', {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Api-Quota-Left': '37' },
  });

  it('leitet die Suche mit Server-Key weiter und reicht Quota-Header durch', async () => {
    // Arrange
    mockFetch(okReply);

    // Act
    const res = await worker.fetch(get('/recipes/complexSearch?query=soup&maxCalories=400&number=5'), RECIPE_ENV);

    // Assert
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { results: [], totalResults: 0 });
    assert.equal(res.headers.get('X-Api-Quota-Left'), '37');
    assert.match(res.headers.get('Access-Control-Expose-Headers'), /X-Api-Quota-Left/);
    const target = new URL(upstream[0].url);
    assert.equal(target.origin + target.pathname, 'https://api.spoonacular.com/recipes/complexSearch');
    assert.equal(target.searchParams.get('query'), 'soup');
    assert.equal(target.searchParams.get('maxCalories'), '400');
    assert.equal(new Headers(upstream[0].init.headers).get('x-api-key'), 'spoon-secret');
  });

  it('antwortet 503 ohne Server-Key und ruft nichts auf', async () => {
    // Arrange
    mockFetch(okReply);

    // Act
    const res = await worker.fetch(get('/recipes/complexSearch?query=soup'), ENV);

    // Assert
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'Rezept-Suche nicht eingerichtet.' });
    assert.equal(upstream.length, 0);
  });

  it('verwirft unbekannte Parameter und einen mitgeschickten apiKey', async () => {
    // Arrange
    mockFetch(okReply);

    // Act
    await worker.fetch(get('/recipes/complexSearch?query=soup&apiKey=fremd&evil=1&sort=random&sortDirection=sideways&diet=vegan'), RECIPE_ENV);

    // Assert
    const params = new URL(upstream[0].url).searchParams;
    assert.equal(params.get('apiKey'), null);
    assert.equal(params.get('evil'), null);
    assert.equal(params.get('sort'), 'random');
    assert.equal(params.get('sortDirection'), null);
    assert.equal(params.get('diet'), 'vegan');
    assert.ok(!upstream[0].url.includes('spoon-secret'));
  });

  it('reicht type, sort, sortDirection und minProtein nur mit erlaubten Werten durch', async () => {
    // Arrange
    mockFetch(okReply);

    // Act
    await worker.fetch(get('/recipes/complexSearch?type=main%20course&sort=healthiness&sortDirection=desc&minProtein=30'), RECIPE_ENV);
    await worker.fetch(get('/recipes/complexSearch?type=evil&sort=price&sortDirection=up'), RECIPE_ENV);

    // Assert
    const first = new URL(upstream[0].url).searchParams;
    assert.equal(first.get('type'), 'main course');
    assert.equal(first.get('sort'), 'healthiness');
    assert.equal(first.get('sortDirection'), 'desc');
    assert.equal(first.get('minProtein'), '30');
    const second = new URL(upstream[1].url).searchParams;
    assert.equal(second.get('type'), null);
    assert.equal(second.get('sort'), null);
    assert.equal(second.get('sortDirection'), null);
  });

  it('begrenzt number auf 20 und setzt einen Standard bei ungültigem Wert', async () => {
    // Arrange
    mockFetch(okReply);

    // Act
    await worker.fetch(get('/recipes/complexSearch?number=500'), RECIPE_ENV);
    await worker.fetch(get('/recipes/complexSearch?number=abc'), RECIPE_ENV);
    await worker.fetch(get('/recipes/complexSearch'), RECIPE_ENV);

    // Assert
    assert.deepEqual(upstream.map((u) => new URL(u.url).searchParams.get('number')), ['20', '10', '10']);
  });

  it('reicht Fehlerstatus wie 402 (Tageslimit) durch', async () => {
    // Arrange
    mockFetch(() => new Response('{"message":"limit"}', { status: 402, headers: { 'Content-Type': 'application/json' } }));

    // Act
    const res = await worker.fetch(get('/recipes/complexSearch?query=a'), RECIPE_ENV);

    // Assert
    assert.equal(res.status, 402);
  });

  it('meldet einen abgelehnten Server-Key als 502 statt 401', async () => {
    // Arrange
    mockFetch(() => new Response('{}', { status: 401 }));

    // Act
    const res = await worker.fetch(get('/recipes/complexSearch?query=a'), RECIPE_ENV);

    // Assert
    assert.equal(res.status, 502);
  });

  it('antwortet 429, wenn das Rate-Limit greift', async () => {
    // Arrange
    mockFetch(okReply);
    const env = { ...RECIPE_ENV, AI_LIMITER: { limit: async () => ({ success: false }) } };

    // Act
    const res = await worker.fetch(get('/recipes/complexSearch?query=a'), env);

    // Assert
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
  });

  it('meldet hasRecipeKey in /health ohne den Wert zu verraten', async () => {
    // Act
    const res = await worker.fetch(get('/health'), RECIPE_ENV);

    // Assert
    const body = await res.json();
    assert.equal(body.hasRecipeKey, true);
    assert.ok(!JSON.stringify(body).includes('spoon-secret'));
  });
});

describe('Tageszähler (WRK-01/SEC-02)', () => {
  function fakeKv(initial = {}) {
    const store = { ...initial };
    return {
      store,
      get: async (k) => store[k] ?? null,
      put: async (k, v) => { store[k] = v; },
    };
  }
  const today = () => `cap:${new Date().toISOString().slice(0, 10)}`;

  it('blockt mit Binding hart, sobald der Deckel erreicht ist, ohne Upstream-Call', async () => {
    mockFetch(() => geminiReply({}));
    const kv = fakeKv({ [today()]: '5' });
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), { ...ENV, DAILY_KV: kv, DAILY_AI_CAP: '5' });
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
    assert.match((await res.json()).error, /Tageslimit/);
  });

  it('zählt Anfragen hoch', async () => {
    mockFetch(() => geminiReply({}));
    const kv = fakeKv();
    const env = { ...ENV, DAILY_KV: kv, DAILY_AI_CAP: '5' };
    await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), env);
    await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), env);
    assert.equal(kv.store[today()], '2');
  });

  it('nutzt den Standarddeckel 2000, wenn DAILY_AI_CAP fehlt', async () => {
    mockFetch(() => geminiReply({}));
    const kv = fakeKv({ [today()]: '1999' });
    const env = { ...ENV, DAILY_KV: kv };
    assert.equal((await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), env)).status, 200);
    assert.equal((await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), env)).status, 429);
  });

  it('läuft ohne Binding fail-open und meldet das in /health', async () => {
    mockFetch(() => geminiReply({}));
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);
    assert.equal(res.status, 200);
    const health = await (await worker.fetch(get('/health'), ENV)).json();
    assert.equal(health.hasDailyCap, false);
    assert.match(health.warning, /Tageslimit/);
  });

  it('meldet hasDailyCap und hasRateLimiter mit Bindings', async () => {
    const env = { ...ENV, DAILY_KV: fakeKv(), AI_LIMITER: { limit: async () => ({ success: true }) } };
    const health = await (await worker.fetch(get('/health'), env)).json();
    assert.equal(health.hasDailyCap, true);
    assert.equal(health.hasRateLimiter, true);
    assert.equal(health.warning, undefined);
  });

  it('antwortet bei konfiguriertem, aber nicht erreichbarem KV mit 503 (fail-closed) ohne Upstream-Call', async () => {
    mockFetch(() => geminiReply({}));
    const kv = { get: async () => { throw new Error('kv down'); }, put: async () => {} };
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), { ...ENV, DAILY_KV: kv });
    assert.equal(res.status, 503);
    assert.equal(upstream.length, 0);
    assert.match((await res.json()).error, /Tageszähler/);
  });

  it('antwortet auch bei fehlschlagendem put mit 503', async () => {
    mockFetch(() => geminiReply({}));
    const kv = { get: async () => null, put: async () => { throw new Error('kv put down'); } };
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), { ...ENV, DAILY_KV: kv });
    assert.equal(res.status, 503);
    assert.equal(upstream.length, 0);
  });

  it('zaehlt Foto-Aufrufe doppelt', async () => {
    mockFetch(() => geminiReply({ name: 'x', facts: {} }));
    const kv = fakeKv();
    const env = { ...ENV, DAILY_KV: kv, DAILY_AI_CAP: '10' };
    await worker.fetch(post({ fn: 'recognizeLabel', payload: { imageBase64: 'QUJD' } }), env);
    assert.equal(kv.store[today()], '2');
    await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), env);
    assert.equal(kv.store[today()], '3');
  });

  it('zaehlt importRecipe mit Bild doppelt', async () => {
    mockFetch(() => geminiReply({ title: 't' }));
    const kv = fakeKv();
    const env = { ...ENV, DAILY_KV: kv, DAILY_AI_CAP: '10' };
    await worker.fetch(post({ fn: 'importRecipe', payload: { imageBase64: 'QUJD' } }), env);
    assert.equal(kv.store[today()], '2');
  });

  it('blockt einen Foto-Aufruf, wenn nur noch ein Slot uebrig ist', async () => {
    mockFetch(() => geminiReply({}));
    const kv = fakeKv({ [today()]: '4' });
    const env = { ...ENV, DAILY_KV: kv, DAILY_AI_CAP: '5' };
    const res = await worker.fetch(post({ fn: 'recognizeLabel', payload: { imageBase64: 'QUJD' } }), env);
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
    assert.equal(kv.store[today()], '4');
  });
});

describe('Gemini-Konfiguration und Fehlerklassen', () => {
  it('setzt maxOutputTokens und temperature 0 für strukturierte Aufgaben', async () => {
    mockFetch(() => geminiReply({ name: 'x', facts: {} }));
    await worker.fetch(post({ fn: 'recognizeLabel', payload: { imageBase64: 'QUJD' } }), ENV);
    const cfg = JSON.parse(upstream[0].init.body).generationConfig;
    assert.equal(cfg.temperature, 0);
    assert.ok(cfg.maxOutputTokens > 0 && cfg.maxOutputTokens <= 8192);
    assert.equal(cfg.responseMimeType, 'application/json');
  });

  it('meldet blockierte Antworten als 422, nicht als überlastet', async () => {
    mockFetch(() => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);
    assert.equal(res.status, 422);
    assert.doesNotMatch((await res.json()).error, /überlastet/);
  });

  it('meldet leere Antworten (finishReason) als 422', async () => {
    mockFetch(() => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { status: 200 }));
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);
    assert.equal(res.status, 422);
    assert.doesNotMatch((await res.json()).error, /überlastet/);
  });

  it('meldet nicht lesbare Antworten ohne Rohtext an den Client', async () => {
    mockFetch(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'GEHEIMER Freitext' }] } }] }), { status: 200 }));
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: FASTFOOD }), ENV);
    assert.equal(res.status, 422);
    assert.doesNotMatch(await res.text(), /GEHEIMER/);
  });

  it('kennt computeTargets nicht mehr', async () => {
    const res = await worker.fetch(post({ fn: 'computeTargets', payload: {} }), ENV);
    assert.equal(res.status, 400);
  });
});

describe('Größenlimits (SEC-08/WRK-09)', () => {
  it('lehnt Fotos über dem Limit mit 413 ab', async () => {
    const big = 'A'.repeat(5 * 1024 * 1024);
    const res = await worker.fetch(post({ fn: 'recognizeLabel', payload: { imageBase64: big } }), ENV);
    assert.equal(res.status, 413);
    assert.equal(upstream.length, 0);
  });

  it('lehnt zu große Bodies ab (auch ohne Content-Length)', async () => {
    const res = await worker.fetch(post({ fn: 'importRecipe', payload: { text: 'x'.repeat(6 * 1024 * 1024) } }), ENV);
    assert.equal(res.status, 413);
  });

  it('lehnt einen Nicht-Objekt-Payload ab', async () => {
    const res = await worker.fetch(post({ fn: 'suggestFastfood', payload: 'text' }), ENV);
    assert.equal(res.status, 400);
  });
});

describe('/off-search Rate-Limit (FDB-02/WRK-07)', () => {
  it('antwortet 429 bei Cache-Miss, wenn OFF_LIMITER greift', async () => {
    mockFetch(() => new Response('{"hits":[]}'));
    const env = { ...ENV, OFF_LIMITER: { limit: async () => ({ success: false }) } };
    const res = await worker.fetch(get('/off-search?q=milch'), env);
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
  });

  it('fällt ohne OFF_LIMITER auf AI_LIMITER zurück', async () => {
    mockFetch(() => new Response('{"hits":[]}'));
    const env = { ...ENV, AI_LIMITER: { limit: async () => ({ success: false }) } };
    const res = await worker.fetch(get('/off-search?q=milch'), env);
    assert.equal(res.status, 429);
  });
});

describe('spoonacular-Cache (WRK-03)', () => {
  const realCaches = globalThis.caches;
  const RECIPE_ENV = { ...ENV, SPOONACULAR_API_KEY: 'spoon-secret' };
  beforeEach(() => {
    const map = new Map();
    globalThis.caches = {
      default: {
        match: async (req) => map.get(req.url)?.clone(),
        put: async (req, res) => { map.set(req.url, res); },
      },
    };
  });
  afterEach(() => { globalThis.caches = realCaches; });

  it('liefert die zweite gleiche Suche aus dem Cache inkl. Quota-Header ohne Upstream-Call', async () => {
    mockFetch(() => new Response('{"results":[]}', { status: 200, headers: { 'Content-Type': 'application/json', 'X-Api-Quota-Left': '40' } }));
    const first = await worker.fetch(get('/recipes/complexSearch?query=soup'), RECIPE_ENV);
    const second = await worker.fetch(get('/recipes/complexSearch?query=soup'), RECIPE_ENV);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('X-Api-Quota-Left'), '40');
    assert.equal(second.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
    assert.equal(upstream.length, 1);
  });

  it('cached keine Fehlerantworten', async () => {
    mockFetch(() => new Response('{"message":"limit"}', { status: 402 }));
    await worker.fetch(get('/recipes/complexSearch?query=soup'), RECIPE_ENV);
    await worker.fetch(get('/recipes/complexSearch?query=soup'), RECIPE_ENV);
    assert.equal(upstream.length, 2);
  });
});

describe('translateRecipe / translateSearchQuery', () => {
  const RECIPE = {
    lang: 'de',
    title: 'Pork shoulder tacos',
    ingredients: ['pork shoulder', 'chopped fresh rosemary'],
    steps: ['Season the pork.', 'Roast at 350 degrees F.'],
  };

  it('übersetzt mit Schema, temperature 0 und Token-Obergrenze', async () => {
    mockFetch(() => geminiReply({ title: 'Schweineschulter-Tacos', ingredients: ['Schweineschulter', 'Rosmarin, frisch'], steps: ['Schweinefleisch würzen.', 'Bei 350 Grad F rösten.'] }));
    const res = await worker.fetch(post({ fn: 'translateRecipe', payload: RECIPE }), ENV);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.title, 'Schweineschulter-Tacos');
    assert.deepEqual(body.ingredients, ['Schweineschulter', 'Rosmarin, frisch']);
    const cfg = JSON.parse(upstream[0].init.body).generationConfig;
    assert.equal(cfg.temperature, 0);
    assert.equal(cfg.responseSchema.type, 'OBJECT');
    assert.ok(cfg.maxOutputTokens > 0 && cfg.maxOutputTokens <= 8192);
  });

  it('gleicht falsche Eintragszahlen und leere Einträge an das Original an', async () => {
    mockFetch(() => geminiReply({ title: ' ', ingredients: ['Nur eins'], steps: ['Würzen.', ' '] }));
    const body = await (await worker.fetch(post({ fn: 'translateRecipe', payload: RECIPE }), ENV)).json();
    assert.equal(body.title, RECIPE.title);
    assert.deepEqual(body.ingredients, RECIPE.ingredients);
    assert.deepEqual(body.steps, ['Würzen.', 'Roast at 350 degrees F.']);
  });

  it('lehnt fehlenden Titel, unbekannte Sprache und zu viele Zutaten mit 400 ab, ohne Upstream-Call', async () => {
    const bad = [
      { ...RECIPE, title: '' },
      { ...RECIPE, lang: 'xx' },
      { ...RECIPE, ingredients: Array.from({ length: 61 }, () => 'salt') },
      { ...RECIPE, steps: 'nope' },
    ];
    for (const payload of bad) {
      const res = await worker.fetch(post({ fn: 'translateRecipe', payload }), ENV);
      assert.equal(res.status, 400);
    }
    assert.equal(upstream.length, 0);
  });

  it('zählt gegen den Tageszähler wie die anderen KI-Funktionen', async () => {
    mockFetch(() => geminiReply({}));
    const store = { [`cap:${new Date().toISOString().slice(0, 10)}`]: '5' };
    const kv = { get: async (k) => store[k] ?? null, put: async (k, v) => { store[k] = v; } };
    const res = await worker.fetch(post({ fn: 'translateRecipe', payload: RECIPE }), { ...ENV, DAILY_KV: kv, DAILY_AI_CAP: '5' });
    assert.equal(res.status, 429);
    assert.equal(upstream.length, 0);
  });

  it('übersetzt Suchbegriffe und fällt bei leerer Antwort auf den Begriff zurück', async () => {
    mockFetch(() => geminiReply({ query: 'chicken' }));
    const ok = await (await worker.fetch(post({ fn: 'translateSearchQuery', payload: { query: 'Hähnchen', lang: 'de' } }), ENV)).json();
    assert.deepEqual(ok, { query: 'chicken' });
    mockFetch(() => geminiReply({ query: '' }));
    const fallback = await (await worker.fetch(post({ fn: 'translateSearchQuery', payload: { query: 'Hähnchen', lang: 'de' } }), ENV)).json();
    assert.deepEqual(fallback, { query: 'Hähnchen' });
    const empty = await worker.fetch(post({ fn: 'translateSearchQuery', payload: { query: ' ' } }), ENV);
    assert.equal(empty.status, 400);
  });
});
