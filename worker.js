/**
 * NutriTrack Cloudflare Worker
 * - GET  /off-search  → OpenFoodFacts-Suche (CORS-Proxy, 1 h gecacht)
 * - GET  /recipes/complexSearch → spoonacular-Rezeptsuche (Key nur als Secret SPOONACULAR_API_KEY)
 * - POST /            → KI-Proxy für Gemini (fn + payload)
 *
 * - GET  /health      → Statusprüfung {ok, hasKey, hasRecipeKey, model, fallbackModel} (kein Key-Wert)
 *
 * Deploy (im Projektordner):
 *   npx wrangler login
 *   npx wrangler secret put GEMINI_API_KEY   (Key einfügen, wenn gefragt)
 *   npx wrangler deploy
 * Prüfen: curl https://nutritrack.baumgartner-jakob12.workers.dev/health
 *
 * Secrets (über Wrangler/Dashboard setzen):
 *   wrangler secret put GEMINI_API_KEY
 *   wrangler secret put SPOONACULAR_API_KEY  (Rezept-Suche)
 * Optional: GEMINI_MODEL, GEMINI_FALLBACK_MODEL (Modellnamen überschreiben)
 * Optional:
 *   ALLOWED_ORIGINS  kommagetrennte Browser-Origins (ersetzt DEFAULT_ORIGINS)
 *   AI_LIMITER       Rate-Limiting-Binding (wrangler.toml [[ratelimits]]) für POST / und die Rezept-Suche
 *
 * Sicherheit: Origin-Allowlist, Payload-Validierung + Größenlimits, Rate-Limit,
 * SSRF-Schutz beim Rezept-Import, Key nur als Header. Der Proxy ist trotzdem
 * öffentlich erreichbar (Origin lässt sich außerhalb von Browsern fälschen) —
 * das Rate-Limit ist der eigentliche Kostenschutz.
 */

const GEMINI_MODEL = 'gemini-3.6-flash';
// Zweites, leichteres Modell, falls das Hauptmodell überlastet oder unbekannt ist.
const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_RETRIES = 1; // zusätzliche Versuche pro Modell bei 500/503/429
const GEMINI_BACKOFF_BASE_MS = 600;
const GEMINI_TOTAL_BUDGET_MS = 25000; // Gesamtzeit über alle Versuche
const GEMINI_ATTEMPT_TIMEOUT_MS = 12000;
const GEMINI_RETRY_AFTER_S = 60;
const OVERLOADED_MESSAGE = 'Die KI ist gerade überlastet — bitte in einer Minute erneut versuchen.';
const TRANSIENT_STATUSES = new Set([429, 500, 503]);
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
// OFF verlangt einen User-Agent mit App-Name + Kontakt (Browser dürfen ihn nicht setzen).
const OFF_USER_AGENT = 'NutriTrack/1.0 (+https://github.com/JakobBaum/NutriTrack)';
const PAGE_USER_AGENT = 'Mozilla/5.0 (compatible; NutriTrack/1.0; +https://github.com/JakobBaum/NutriTrack)';

const DEFAULT_ORIGINS = [
  'https://jakobbaum.github.io',
  'capacitor://localhost', // iOS-App
  'ionic://localhost',
  'https://localhost', // Android-App
  'http://localhost',
  'http://localhost:4200',
  'http://localhost:8100',
];

const SPOONACULAR_URL = 'https://api.spoonacular.com/recipes/complexSearch';
// Erlaubte Parameter = die aus buildSearchParams (spoonacular.query.ts); apiKey wird nie durchgereicht.
const RECIPE_PARAMS = [
  'number', 'offset', 'query', 'maxCalories', 'maxReadyTime', 'minProtein', 'diet',
  'addRecipeNutrition', 'addRecipeInstructions', 'fillIngredients', 'instructionsRequired',
];
// Parameter mit festem Wertebereich: andere Werte werden verworfen (Spiegel: spoonacular.query.ts).
const RECIPE_ENUM_PARAMS = {
  type: [
    'main course', 'side dish', 'dessert', 'appetizer', 'salad', 'bread', 'breakfast',
    'soup', 'beverage', 'sauce', 'marinade', 'fingerfood', 'snack', 'drink',
  ],
  sort: ['healthiness', 'popularity', 'random'],
  sortDirection: ['asc', 'desc'],
};
const RECIPE_MAX_NUMBER = 20;
const RECIPE_DEFAULT_NUMBER = 10;
const RECIPE_TIMEOUT_MS = 12000;
const RECIPE_PASSTHROUGH_HEADERS = ['Content-Type', 'X-Api-Quota-Left', 'Retry-After'];
const RECIPE_NOT_CONFIGURED = 'Rezept-Suche nicht eingerichtet.';
const RECIPE_UNAVAILABLE = 'Rezept-Suche ist serverseitig gerade nicht verfügbar.';
const RECIPE_TIMEOUT_MESSAGE = 'Die Rezept-Suche antwortet gerade nicht.';
const SEARCH_PARAMS =['q', 'page', 'page_size', 'fields', 'langs', 'sort_by'];
const MAX_QUERY_CHARS = 200;
const MAX_PAGE_SIZE = 50;
const SEARCH_CACHE_TTL_S = 3600;
const PREFLIGHT_MAX_AGE_S = 86400;

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_CHARS = 9 * 1024 * 1024; // Base64 eines ~6-MB-Fotos
const MAX_TEXT_CHARS = 20000;
const MAX_PAGE_BYTES = 1024 * 1024;
const MAX_PROMPT_PAGE_CHARS = 12000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10000;

const AI_FUNCTIONS = {
  generateShoppingList: { validate: validateShoppingRequest, run: generateShoppingList },
  recognizeLabel: { validate: validateLabelRequest, run: recognizeLabel },
  suggestFastfood: { validate: validateFastfoodRequest, run: suggestFastfood },
  importRecipe: { validate: validateImportRequest, run: importRecipe },
  computeTargets: { validate: validateProfile, run: computeTargets },
};

/** Fehler, die als 4xx an den Client gehen (Eingabe ist schuld, nicht der Server). */
class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Gemini dauerhaft überlastet/limitiert → 503 mit Retry-After statt 500. */
class OverloadedError extends Error {}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json({ error: 'Origin nicht erlaubt.' }, 403);
    }
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/off-search') {
        return await offSearch(url, cors);
      }
      if (request.method === 'GET' && url.pathname === '/recipes/complexSearch') {
        return await recipeSearch(request, url, env, cors);
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({
          ok: true,
          hasKey: Boolean(env.GEMINI_API_KEY),
          hasRecipeKey: Boolean(env.SPOONACULAR_API_KEY),
          model: env.GEMINI_MODEL || GEMINI_MODEL,
          fallbackModel: env.GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL,
        }, 200, cors);
      }
      if (request.method === 'POST' && url.pathname === '/') {
        return await aiProxy(request, env, cors);
      }
      return json({ error: 'Nicht gefunden.' }, 404, cors);
    } catch (e) {
      if (e instanceof OverloadedError) {
        return json({ error: OVERLOADED_MESSAGE }, 503, { ...cors, 'Retry-After': String(GEMINI_RETRY_AFTER_S) });
      }
      if (e instanceof ClientError) return json({ error: e.message }, e.status, cors);
      console.error('Worker-Fehler:', e);
      return json({ error: e?.message ?? 'Interner Fehler.' }, 500, cors);
    }
  },
};

// ── CORS ───────────────────────────────────────────────────────────────

function allowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // User-Agent zulassen: ältere App-Versionen senden ihn, Safari/Firefox fragen dafür per Preflight.
    'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
    'Access-Control-Expose-Headers': 'X-Api-Quota-Left, Retry-After',
    'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_S),
    Vary: 'Origin',
  };
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── OpenFoodFacts-Proxy ────────────────────────────────────────────────

function buildSearchUrl(url) {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) throw new ClientError(400, 'Suchbegriff fehlt.');
  if (q.length > MAX_QUERY_CHARS) throw new ClientError(400, 'Suchbegriff zu lang.');

  const target = new URL(OFF_SEARCH_URL);
  for (const key of SEARCH_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) target.searchParams.set(key, key === 'q' ? q : value);
  }
  const size = Number(target.searchParams.get('page_size') ?? 12);
  const clamped = Number.isFinite(size) ? Math.min(Math.max(1, Math.round(size)), MAX_PAGE_SIZE) : 12;
  target.searchParams.set('page_size', String(clamped));
  return target;
}

async function offSearch(url, cors) {
  const target = buildSearchUrl(url);
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(target.toString());
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return withHeaders(cached, cors);

  const resp = await fetch(target.toString(), {
    headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const passthrough = { 'Content-Type': 'application/json' };
  const retryAfter = resp.headers.get('Retry-After');
  if (retryAfter) passthrough['Retry-After'] = retryAfter;
  const body = await resp.text();

  if (resp.ok && cache) {
    const toCache = new Response(body, {
      status: 200,
      headers: { ...passthrough, 'Cache-Control': `public, max-age=${SEARCH_CACHE_TTL_S}` },
    });
    await cache.put(cacheKey, toCache);
  }
  return new Response(body, { status: resp.status, headers: { ...passthrough, ...cors } });
}

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

// ── spoonacular-Proxy ──────────────────────────────────────────────────

function buildRecipeUrl(url) {
  const target = new URL(SPOONACULAR_URL);
  for (const key of RECIPE_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) target.searchParams.set(key, value.slice(0, MAX_QUERY_CHARS));
  }
  for (const [key, allowed] of Object.entries(RECIPE_ENUM_PARAMS)) {
    const value = (url.searchParams.get(key) ?? '').trim().toLowerCase();
    if (allowed.includes(value)) target.searchParams.set(key, value);
  }
  const requested = Math.round(Number(target.searchParams.get('number') ?? RECIPE_DEFAULT_NUMBER));
  const number = Number.isFinite(requested) ? Math.min(Math.max(1, requested), RECIPE_MAX_NUMBER) : RECIPE_DEFAULT_NUMBER;
  target.searchParams.set('number', String(number));
  return target;
}

function recipeResponseHeaders(resp, cors) {
  const headers = { ...cors };
  for (const name of RECIPE_PASSTHROUGH_HEADERS) {
    const value = resp.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

async function recipeSearch(request, url, env, cors) {
  if (!env.SPOONACULAR_API_KEY) return json({ error: RECIPE_NOT_CONFIGURED }, 503, cors);
  if (await isRateLimited(env, request)) {
    return json({ error: 'Zu viele Anfragen — bitte kurz warten.' }, 429, { ...cors, 'Retry-After': '60' });
  }
  const target = buildRecipeUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);
  try {
    const resp = await fetch(target.toString(), {
      headers: { 'x-api-key': env.SPOONACULAR_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    // Ungültiger/gesperrter Server-Key ist kein Fehler des Nutzers.
    if (resp.status === 401 || resp.status === 403) return json({ error: RECIPE_UNAVAILABLE }, 502, cors);
    return new Response(await resp.text(), { status: resp.status, headers: recipeResponseHeaders(resp, cors) });
  } catch (e) {
    if (e?.name === 'AbortError') return json({ error: RECIPE_TIMEOUT_MESSAGE }, 504, cors);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── KI-Proxy ───────────────────────────────────────────────────────────

async function aiProxy(request, env, cors) {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new ClientError(413, 'Anfrage zu groß.');
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new ClientError(413, 'Anfrage zu groß.');

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ClientError(400, 'Ungültiger JSON-Body.');
  }
  const handler = Object.hasOwn(AI_FUNCTIONS, body?.fn) ? AI_FUNCTIONS[body.fn] : null;
  if (!handler) throw new ClientError(400, `Unbekannte Funktion: ${String(body?.fn).slice(0, 40)}`);
  const payload = handler.validate(body.payload ?? {});

  if (!env.GEMINI_API_KEY) throw new ClientError(503, 'KI ist auf dem Server nicht konfiguriert.');
  if (await isRateLimited(env, request)) {
    return json({ error: 'Zu viele KI-Anfragen — bitte kurz warten.' }, 429, { ...cors, 'Retry-After': '60' });
  }
  return json(await handler.run(payload, env), 200, cors);
}

async function isRateLimited(env, request) {
  if (typeof env.AI_LIMITER?.limit !== 'function') return false;
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.AI_LIMITER.limit({ key });
  return !success;
}

// ── Eingabe-Validierung ────────────────────────────────────────────────

function num(value, min, max, name) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw new ClientError(400, `${name} ungültig.`);
  }
  return n;
}

function optNum(value, min, max, name) {
  return value === undefined || value === null || value === '' ? undefined : num(value, min, max, name);
}

/** Kürzt und entschärft Freitext für Prompts (keine Steuerzeichen). */
function text(value, maxChars) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, maxChars);
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new ClientError(400, `${name} ungültig.`);
  return value;
}

function image(value) {
  if (typeof value !== 'string' || value.length === 0) throw new ClientError(400, 'Foto fehlt.');
  if (value.length > MAX_IMAGE_CHARS) throw new ClientError(413, 'Foto zu groß.');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) throw new ClientError(400, 'Foto ist kein Base64.');
  return value;
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function validateShoppingRequest(p) {
  const meals = Array.isArray(p.meals) ? p.meals.filter((m) => MEALS.includes(m)) : [];
  if (meals.length === 0) throw new ClientError(400, 'Mahlzeiten fehlen.');
  return {
    persons: num(p.persons, 1, 20, 'Personen'),
    days: num(p.days, 1, 14, 'Tage'),
    meals,
    budget: optNum(p.budget, 0, 5000, 'Budget'),
    store: text(p.store, 40),
    recipeNames: (Array.isArray(p.recipes) ? p.recipes : []).slice(0, 30).map((r) => text(r?.title, 80)).filter(Boolean),
  };
}

function validateLabelRequest(p) {
  return { imageBase64: image(p.imageBase64), basis: oneOf(p.basis ?? 'per100g', ['per100g', 'perPortion'], 'Basis') };
}

function validateFastfoodRequest(p) {
  return {
    restaurant: text(p.restaurant, 60),
    kcalBudget: num(p.kcalBudget, 50, 5000, 'Kalorienbudget'),
    moneyBudget: optNum(p.moneyBudget, 0, 200, 'Geldbudget'),
    preference: text(p.preference, 60),
  };
}

function validateImportRequest(p) {
  if (p.imageBase64) return { imageBase64: image(p.imageBase64) };
  if (p.url) {
    const url = text(p.url, 2048);
    if (!isPublicHttpUrl(url)) throw new ClientError(400, 'Diese URL kann nicht importiert werden.');
    return { url, text: text(p.text, MAX_TEXT_CHARS) };
  }
  const recipeText = text(p.text, MAX_TEXT_CHARS);
  if (!recipeText) throw new ClientError(400, 'Rezept-Text, Link oder Foto fehlt.');
  return { text: recipeText };
}

function validateProfile(p) {
  return {
    weightKg: num(p.weightKg, 25, 350, 'Gewicht'),
    heightCm: num(p.heightCm, 100, 250, 'Größe'),
    age: num(p.age, 12, 110, 'Alter'),
    sex: oneOf(p.sex, ['male', 'female', 'diverse'], 'Geschlecht'),
    activityLevel: text(p.activityLevel, 30),
    goal: oneOf(p.goal, ['lose', 'maintain', 'gain'], 'Ziel'),
    rateKgPerWeek: optNum(p.rateKgPerWeek, 0, 1.5, 'Tempo') ?? 0.5,
  };
}

// ── SSRF-Schutz + Seitentext ───────────────────────────────────────────

function isPrivateIPv4(host) {
  const [a, b] = host.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

/** Nur öffentliche http(s)-Ziele: keine IP-Literale aus privaten Netzen, kein localhost. */
function isPublicHttpUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home)$/.test(host)) return false;
  if (host.startsWith('[') || host.includes(':')) return false; // IPv6-Literale
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return !isPrivateIPv4(host);
  return host.includes('.');
}

async function readCapped(resp, maxBytes) {
  const reader = resp.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, all.length - offset);
    all.set(part, offset);
    offset += part.length;
    if (offset >= all.length) break;
  }
  return new TextDecoder().decode(all);
}

/** Holt eine Rezeptseite; jede Weiterleitung wird erneut gegen SSRF geprüft. */
async function fetchPublicPage(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpUrl(current)) throw new ClientError(400, 'Diese URL kann nicht importiert werden.');
    const resp = await fetch(current, {
      headers: { 'User-Agent': PAGE_USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const location = resp.headers.get('Location');
    if (resp.status >= 300 && resp.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    if (!resp.ok) throw new ClientError(422, `Rezeptseite antwortet mit HTTP ${resp.status}.`);
    const type = resp.headers.get('Content-Type') ?? '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      throw new ClientError(422, 'Link zeigt auf keine Webseite.');
    }
    return readCapped(resp, MAX_PAGE_BYTES);
  }
  throw new ClientError(422, 'Zu viele Weiterleitungen.');
}

function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findRecipeNode(n);
      if (found) return found;
    }
    return null;
  }
  const type = node['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return node;
  return node['@graph'] ? findRecipeNode(node['@graph']) : null;
}

/** Bevorzugt schema.org-Recipe (JSON-LD, haben fast alle Rezeptseiten), sonst sichtbarer Text. */
function extractRecipeText(html) {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, block] of blocks) {
    try {
      const recipe = findRecipeNode(JSON.parse(block));
      if (recipe) return JSON.stringify(recipe).slice(0, MAX_PROMPT_PAGE_CHARS);
    } catch {
      // kaputtes JSON-LD → nächster Block / Fallback
    }
  }
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_PAGE_CHARS);
}

// ── Gemini ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True, wenn Gemini das Modell ablehnt (unbekannt/nicht verfügbar) statt die Eingabe. */
function isModelError(status, message) {
  return status === 404 || (status === 400 && /model/i.test(message));
}

/** Ein Gemini-Request; liefert die (ggf. fehlerhafte) Response oder wirft bei Netzfehlern. */
async function geminiRequest(model, body, env, timeoutMs) {
  return fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Hauptmodell mit Retry (Backoff + Jitter, innerhalb des Gesamtbudgets),
 * danach Fallback-Modell. Gibt die erste erfolgreiche Response zurück;
 * bleibt alles transient kaputt → OverloadedError, sonst Error mit Status.
 */
async function geminiWithFallback(body, env) {
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
  let lastTransient = false;
  let lastError = null;
  // Modellnamen per Worker-Variable überschreibbar (wrangler.toml [vars]), ohne Code-Deploy.
  const models = [env.GEMINI_MODEL || GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL];
  for (const model of models) {
    for (let attempt = 0; attempt <= GEMINI_RETRIES; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new OverloadedError('Gemini-Zeitbudget erschöpft');
      let resp;
      try {
        resp = await geminiRequest(model, body, env, Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining));
      } catch (fetchErr) {
        lastTransient = true;
        lastError = new Error(`Gemini nicht erreichbar: ${fetchErr.message}`);
        resp = null;
      }
      if (resp?.ok) return resp;
      if (resp) {
        const errBody = await resp.text().catch(() => '');
        let msg = errBody.slice(0, 200);
        try {
          msg = JSON.parse(errBody)?.error?.message ?? msg;
        } catch {
          // Body war kein JSON — Rohtext reicht
        }
        lastTransient = TRANSIENT_STATUSES.has(resp.status);
        lastError = new Error(`Gemini ${resp.status}: ${msg}`);
        if (!lastTransient) {
          // Modell unbekannt (404 bzw. 400 "model"): sofort das nächste Modell probieren.
          if (isModelError(resp.status, msg) && model !== models[models.length - 1]) break;
          throw lastError;
        }
      }
      if (attempt < GEMINI_RETRIES) {
        const backoff = GEMINI_BACKOFF_BASE_MS * 2 ** attempt + Math.random() * 250;
        if (deadline - Date.now() <= backoff) break;
        await sleep(backoff);
      }
    }
  }
  if (lastTransient) throw new OverloadedError(lastError?.message ?? 'Gemini überlastet');
  throw lastError ?? new Error('Gemini nicht erreichbar.');
}

async function gemini(prompt, env, imageBase64 = null) {
  const parts = imageBase64
    ? [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }]
    : [{ text: prompt }];
  const body = JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } });
  const resp = await geminiWithFallback(body, env);

  const data = await resp.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!answer) throw new Error('Gemini hat leere Antwort zurückgegeben.');

  const match = answer.match(/```json\s*([\s\S]*?)```/) ?? answer.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try {
      return JSON.parse(match[1] ?? match[0]);
    } catch {
      // fällt auf Gesamttext zurück
    }
  }
  try {
    return JSON.parse(answer);
  } catch {
    throw new Error(`Gemini-Antwort kein JSON: ${answer.slice(0, 200)}`);
  }
}

// ── KI-Funktionen ──────────────────────────────────────────────────────

async function generateShoppingList(req, env) {
  const prompt = `Du bist ein Ernährungs-Assistent. Erstelle eine Einkaufsliste für ${req.persons} Person(en) für ${req.days} Tag(e).
Mahlzeiten: ${req.meals.join(', ')}.
${req.budget ? `Budget: ca. ${req.budget} €.` : ''}
${req.store ? `Markt: ${req.store}.` : ''}
${req.recipeNames.length ? `Vorhandene Rezepte als Basis: ${req.recipeNames.join(', ')}.` : ''}

Antworte NUR mit gültigem JSON (kein Markdown):
{
  "items": [{"name":"string","amount":number,"unit":"string","checked":false,"estPrice":number}],
  "suggestedDishes": ["string"],
  "estTotal": number,
  "note": "string oder null"
}`;
  return gemini(prompt, env);
}

async function recognizeLabel(req, env) {
  const prompt = `Lies die Nährwerttabelle auf diesem Lebensmitteletikett und gib die Werte ${req.basis === 'per100g' ? 'je 100 g' : 'je Portion'} zurück.
Antworte NUR mit gültigem JSON:
{
  "name": "Produktname",
  "facts": {
    "kcal": number,
    "proteinG": number,
    "carbsG": number,
    "fatG": number,
    "fiberG": number,
    "sugarG": number,
    "saltG": number,
    "basis": "${req.basis}",
    "portionG": number oder null
  }
}`;
  return gemini(prompt, env, req.imageBase64);
}

async function suggestFastfood(req, env) {
  const prompt = `Du bist ein Ernährungs-Coach. Schlage 3 Fastfood-Optionen vor.
Restaurant: ${req.restaurant || 'beliebig'}.
Kalorienbudget: ${req.kcalBudget} kcal.
${req.moneyBudget ? `Geldbudget: ${req.moneyBudget} €.` : ''}
Priorität: ${req.preference || 'proteinreich'}.

Antworte NUR mit gültigem JSON-Array:
[{
  "restaurant": "string",
  "itemName": "string",
  "facts": {"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"basis":"perPortion"},
  "rationale": "string",
  "estPrice": number
}]`;
  return gemini(prompt, env);
}

const IMPORT_SCHEMA = `Antworte NUR mit gültigem JSON:
{
  "title": "string",
  "servings": number,
  "ingredients": [{"name":"string","amount":number,"unit":"string",
    "facts":{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number,
             "basis":"per100g"|"perPortion","portionG":number}}],
  "steps": ["string"]
}
Mengen als Zahl, Einheit getrennt (z.B. "g","ml","EL","Stk"). servings als Ganzzahl (Standard 2).
Nährwerte je Zutat: bei g/ml je 100 g (basis "per100g"), bei Stück/Löffel/Zehe für EINE Einheit
(basis "perPortion", portionG = ungefähres Gewicht einer Einheit in g). Unbekannte Zutat → "facts" weglassen.
Zutaten und Schritte auf Deutsch.`;

async function importRecipe(req, env) {
  let prompt;
  if (req.imageBase64) {
    prompt = 'Extrahiere das Rezept aus diesem Foto.';
  } else if (req.url) {
    const page = await fetchPublicPage(req.url).catch((e) => {
      if (req.text) return req.text;
      throw e;
    });
    prompt = `Extrahiere das Rezept aus folgendem Seiteninhalt (Quelle: ${req.url}):\n\n${extractRecipeText(page)}`;
  } else {
    prompt = `Extrahiere das Rezept aus folgendem Text:\n\n${req.text}`;
  }
  return gemini(`${prompt}\n\n${IMPORT_SCHEMA}`, env, req.imageBase64 ?? null);
}

async function computeTargets(profile, env) {
  const prompt = `Berechne den täglichen Kalorienbedarf und Makros für:
Gewicht: ${profile.weightKg} kg, Größe: ${profile.heightCm} cm, Alter: ${profile.age}, Geschlecht: ${profile.sex}.
Aktivität: ${profile.activityLevel}, Ziel: ${profile.goal}, Tempo: ${profile.rateKgPerWeek} kg/Woche.
Verwende die Mifflin-St-Jeor-Formel.

Antworte NUR mit gültigem JSON:
{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number}`;
  return gemini(prompt, env);
}
