/**
 * NutriTrack Cloudflare Worker
 * - GET  /off-search  → OpenFoodFacts-Suche (CORS-Proxy, 1 h gecacht)
 * - GET  /recipes/complexSearch → spoonacular-Rezeptsuche (Key nur als Secret SPOONACULAR_API_KEY)
 * - POST /            → KI-Proxy für Gemini (fn + payload)
 *
 * - GET  /health      → Statusprüfung {ok, hasKey, hasRecipeKey, hasRateLimiter, hasDailyCap, model,
 *                       fallbackModel, warning?} (kein Key-Wert)
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
 *   OFF_LIMITER      eigenes Rate-Limiting-Binding für /off-search (Fallback: AI_LIMITER)
 *   DAILY_KV         KV-Namespace-Binding für den globalen Tageszähler der KI-Aufrufe
 *                    (ohne Binding: kein Deckel, /health meldet hasDailyCap=false + warning;
 *                    mit Binding aber KV-Ausfall: fail-closed, 503; Foto-Aufrufe zählen doppelt)
 *   DAILY_AI_CAP     Deckel pro UTC-Tag (Standard 2000)
 *
 * Sicherheit: Origin-Allowlist, Payload-Validierung + Größenlimits, Rate-Limit pro IP,
 * globaler Tagesdeckel, SSRF-Schutz beim Rezept-Import, Key nur als Header,
 * generische Fehlermeldungen an den Client (Details nur im Log). Der Proxy ist
 * öffentlich erreichbar (Origin lässt sich außerhalb von Browsern fälschen) —
 * Rate-Limit und Tagesdeckel sind der eigentliche Kostenschutz.
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
// Listenparameter (Spiegel: spoonacular.query.ts): nur Buchstaben, Leerzeichen, Komma und Bindestrich, begrenzte Länge.
const RECIPE_LIST_PARAMS = ['intolerances', 'excludeIngredients'];
const RECIPE_LIST_MAX_CHARS = 200; // gleicher Wert wie MAX_FILTER_PARAM_CHARS in der App (diet-options.ts)
const RECIPE_INTOLERANCES = ['dairy', 'egg', 'gluten', 'peanut', 'seafood', 'shellfish', 'soy', 'tree nut', 'wheat', 'sesame'];
const RECIPE_LIST_PATTERN = /^[\p{L} ,-]+$/u;
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
const RECIPE_CACHE_TTL_S = 6 * 3600;
const RECIPE_CACHED_HEADERS = ['Content-Type', 'X-Api-Quota-Left'];

const DEFAULT_DAILY_CAP = 2000;
const DAILY_KEY_TTL_S = 2 * 86400;
const DAILY_LIMIT_MESSAGE = 'Das Tageslimit für KI-Anfragen ist erreicht — bitte morgen erneut versuchen.';
const DAILY_UNAVAILABLE_MESSAGE = 'Der Tageszähler für KI-Anfragen ist gerade nicht erreichbar — bitte später erneut versuchen.';
const PHOTO_CALL_WEIGHT = 2;
const NO_DAILY_CAP_WARNING = 'Kein Tageslimit aktiv (KV-Binding DAILY_KV fehlt).';
const RATE_LIMIT_RETRY_AFTER_S = '60';
const GENERIC_ERROR_MESSAGE = 'Interner Fehler.';
const BLOCKED_MESSAGE = 'Die KI hat diese Anfrage aus Sicherheitsgründen abgelehnt.';
const EMPTY_ANSWER_MESSAGE = 'Die KI hat keine verwertbare Antwort geliefert — bitte erneut versuchen.';
const BLOCKING_FINISH_REASONS = new Set(['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

// Foto-Obergrenze: die App skaliert auf ~1600 px; 4 Mio. Base64-Zeichen ≈ 3 MB Bild.
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_CHARS = 4 * 1024 * 1024;
const ALLOWED_PORTS = new Set(['80', '443']);

// Strukturierte Aufgaben: deterministisch (temperature 0) und mit Ausgabe-Obergrenze (Kostenschutz).
const TOKENS_LABEL = 1024;
const TOKENS_LIST = 4096;
const TOKENS_FASTFOOD = 2048;
const TOKENS_IMPORT = 8192;
const TOKENS_TRANSLATE = 4096;
const TOKENS_QUERY = 128;
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
  translateRecipe: { validate: validateTranslateRequest, run: translateRecipe },
  translateSearchQuery: { validate: validateQueryTranslateRequest, run: translateSearchQuery },
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
        return await offSearch(request, url, env, cors);
      }
      if (request.method === 'GET' && url.pathname === '/recipes/complexSearch') {
        return await recipeSearch(request, url, env, cors);
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        return json(healthStatus(env), 200, cors);
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
      // Details nur ins Log: Upstream-Meldungen können interne Hinweise enthalten.
      console.error('Worker-Fehler:', e);
      return json({ error: GENERIC_ERROR_MESSAGE }, 500, cors);
    }
  },
};

function hasBinding(binding, method) {
  return typeof binding?.[method] === 'function';
}

function healthStatus(env) {
  const hasDailyCap = hasBinding(env.DAILY_KV, 'get');
  return {
    ok: true,
    hasKey: Boolean(env.GEMINI_API_KEY),
    hasRecipeKey: Boolean(env.SPOONACULAR_API_KEY),
    hasRateLimiter: hasBinding(env.AI_LIMITER, 'limit'),
    hasDailyCap,
    ...(hasDailyCap ? {} : { warning: NO_DAILY_CAP_WARNING }),
    model: env.GEMINI_MODEL || GEMINI_MODEL,
    fallbackModel: env.GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL,
  };
}

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

async function offSearch(request, url, env, cors) {
  const target = buildSearchUrl(url);
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(target.toString());
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return withHeaders(cached, cors);
  // Nur Cache-Misses kosten Upstream-Aufrufe → nur sie werden begrenzt.
  if (await isRateLimited(env.OFF_LIMITER ?? env.AI_LIMITER, request)) {
    return rateLimitedResponse('Zu viele Suchanfragen — bitte kurz warten.', cors);
  }

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

/** Behält nur Werte der festen Unverträglichkeiten-Liste (unbekannte fallen weg); '' wenn nichts übrig bleibt. */
function onlyKnownIntolerances(value) {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => RECIPE_INTOLERANCES.includes(item))
    .join(',');
}

function buildRecipeUrl(url) {
  const target = new URL(SPOONACULAR_URL);
  for (const key of RECIPE_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) target.searchParams.set(key, value.slice(0, MAX_QUERY_CHARS));
  }
  for (const key of RECIPE_LIST_PARAMS) {
    const value = (url.searchParams.get(key) ?? '').trim();
    if (value.length === 0 || value.length > RECIPE_LIST_MAX_CHARS || !RECIPE_LIST_PATTERN.test(value)) continue;
    const accepted = key === 'intolerances' ? onlyKnownIntolerances(value) : value;
    if (accepted !== '') target.searchParams.set(key, accepted);
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

async function cacheRecipeResponse(cache, cacheKey, body, resp) {
  const headers = { 'Cache-Control': `public, max-age=${RECIPE_CACHE_TTL_S}` };
  for (const name of RECIPE_CACHED_HEADERS) {
    const value = resp.headers.get(name);
    if (value) headers[name] = value;
  }
  try {
    await cache.put(cacheKey, new Response(body, { status: 200, headers }));
  } catch (e) {
    console.warn('Rezept-Cache nicht beschreibbar:', e);
  }
}

async function recipeSearch(request, url, env, cors) {
  if (!env.SPOONACULAR_API_KEY) return json({ error: RECIPE_NOT_CONFIGURED }, 503, cors);
  const target = buildRecipeUrl(url);
  // Der API-Key steht im Header, nicht in der URL → die URL ist ein sicherer Cache-Key.
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(target.toString());
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return withHeaders(cached, cors);
  if (await isRateLimited(env.AI_LIMITER, request)) {
    return rateLimitedResponse('Zu viele Anfragen — bitte kurz warten.', cors);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);
  try {
    const resp = await fetch(target.toString(), {
      headers: { 'x-api-key': env.SPOONACULAR_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    // Ungültiger/gesperrter Server-Key ist kein Fehler des Nutzers.
    if (resp.status === 401 || resp.status === 403) return json({ error: RECIPE_UNAVAILABLE }, 502, cors);
    const body = await resp.text();
    if (resp.ok && cache) await cacheRecipeResponse(cache, cacheKey, body, resp);
    return new Response(body, { status: resp.status, headers: recipeResponseHeaders(resp, cors) });
  } catch (e) {
    if (e?.name === 'AbortError') return json({ error: RECIPE_TIMEOUT_MESSAGE }, 504, cors);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── KI-Proxy ───────────────────────────────────────────────────────────

async function aiProxy(request, env, cors) {
  const raw = await readBodyCapped(request, MAX_BODY_BYTES);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ClientError(400, 'Ungültiger JSON-Body.');
  }
  const handler = typeof body?.fn === 'string' && Object.hasOwn(AI_FUNCTIONS, body.fn) ? AI_FUNCTIONS[body.fn] : null;
  if (!handler) throw new ClientError(400, 'Unbekannte Funktion.');
  const rawPayload = body.payload ?? {};
  if (typeof rawPayload !== 'object' || Array.isArray(rawPayload)) throw new ClientError(400, 'Payload ungültig.');
  const payload = handler.validate(rawPayload);

  if (!env.GEMINI_API_KEY) throw new ClientError(503, 'KI ist auf dem Server nicht konfiguriert.');
  if (await isRateLimited(env.AI_LIMITER, request)) {
    return rateLimitedResponse('Zu viele KI-Anfragen — bitte kurz warten.', cors);
  }
  const slot = await takeDailySlot(env, dailyWeight(body.fn, payload));
  if (slot === 'limit') return json({ error: DAILY_LIMIT_MESSAGE }, 429, { ...cors, 'Retry-After': '3600' });
  if (slot === 'unavailable') return json({ error: DAILY_UNAVAILABLE_MESSAGE }, 503, { ...cors, 'Retry-After': '60' });
  return json(await handler.run(payload, env), 200, cors);
}

/** Liest den Body mit hartem Byte-Limit (auch ohne/mit falschem Content-Length). */
async function readBodyCapped(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > maxBytes) throw new ClientError(413, 'Anfrage zu groß.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ClientError(413, 'Anfrage zu groß.');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

async function isRateLimited(limiter, request) {
  if (!hasBinding(limiter, 'limit')) return false;
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await limiter.limit({ key });
  return !success;
}

function rateLimitedResponse(message, cors) {
  return json({ error: message }, 429, { ...cors, 'Retry-After': RATE_LIMIT_RETRY_AFTER_S });
}

/**
 * Globaler Tageszähler (UTC) über KV. Ergebnis: 'ok' | 'limit' (Deckel erreicht) | 'unavailable'.
 * Ohne Binding: fail-open ('ok', /health meldet hasDailyCap=false + warning).
 * Binding konfiguriert, KV aber nicht erreichbar: fail-closed ('unavailable'), damit ein
 * KV-Ausfall den Kostenschutz nicht aushebelt. KV ist nicht atomar, bei gleichzeitigen
 * Anfragen kann der Deckel daher knapp überschritten werden.
 * `weight` = Gewicht des Aufrufs (Foto-Aufrufe zählen doppelt).
 */
async function takeDailySlot(env, weight = 1) {
  if (!hasBinding(env.DAILY_KV, 'get')) return 'ok';
  const parsedCap = Number.parseInt(env.DAILY_AI_CAP ?? '', 10);
  const cap = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : DEFAULT_DAILY_CAP;
  const key = `cap:${new Date().toISOString().slice(0, 10)}`;
  try {
    const used = Number(await env.DAILY_KV.get(key)) || 0;
    if (used + weight > cap) return 'limit';
    await env.DAILY_KV.put(key, String(used + weight), { expirationTtl: DAILY_KEY_TTL_S });
    return 'ok';
  } catch (e) {
    console.error('Tageszähler (KV) nicht verfügbar — Aufruf wird abgelehnt:', e);
    return 'unavailable';
  }
}

/** Foto-Aufrufe (Vision) sind teurer und zählen doppelt gegen den Tagesdeckel. */
function dailyWeight(fn, payload) {
  return (fn === 'recognizeLabel' || fn === 'importRecipe') && payload.imageBase64 ? PHOTO_CALL_WEIGHT : 1;
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

// Fastfood-Helfer: Obergrenzen und feste Länderliste (Sortiment gilt je Land).
const FASTFOOD_MAX_PREFERENCES = 4;
const FASTFOOD_PREFERENCE_CHARS = 30;
const FASTFOOD_MAX_EXCLUDE = 20;
const FASTFOOD_EXCLUDE_CHARS = 60;
const FASTFOOD_COUNTRIES = [
  'Österreich', 'Deutschland', 'Schweiz', 'Italien', 'Spanien', 'Frankreich', 'Niederlande', 'Vereinigtes Königreich', 'USA',
];
const FASTFOOD_DEFAULT_COUNTRY = FASTFOOD_COUNTRIES[0];

/** Einzeiliger Freitext für Prompts: alle Steuerzeichen (auch Zeilenumbrüche) werden zu Leerzeichen. */
function lineText(value, maxChars) {
  return text(String(value ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' '), maxChars);
}

/** Liste aus Kurztexten: fehlt sie, ist sie leer; kein Array ist ein Fehler; leere Einträge entfallen. */
function lineList(value, maxItems, maxChars, name) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ClientError(400, `${name} ungültig.`);
  return value.slice(0, maxItems).map((v) => lineText(v, maxChars)).filter(Boolean);
}

function validateFastfoodRequest(p) {
  return {
    restaurant: lineText(p.restaurant, 60),
    kcalBudget: num(p.kcalBudget, 50, 5000, 'Kalorienbudget'),
    moneyBudget: optNum(p.moneyBudget, 0, 200, 'Geldbudget'),
    preference: lineText(p.preference, 60),
    preferences: lineList(p.preferences, FASTFOOD_MAX_PREFERENCES, FASTFOOD_PREFERENCE_CHARS, 'Kriterien'),
    country: FASTFOOD_COUNTRIES.includes(p.country) ? p.country : FASTFOOD_DEFAULT_COUNTRY,
    // Die jüngsten Namen zählen: die App hängt neue Runden hinten an.
    exclude: lineList(Array.isArray(p.exclude) ? p.exclude.slice(-FASTFOOD_MAX_EXCLUDE) : p.exclude, FASTFOOD_MAX_EXCLUDE, FASTFOOD_EXCLUDE_CHARS, 'Ausschlussliste'),
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

// Übersetzung: Zielsprachen (erweiterbar) und Obergrenzen je Rezept.
const TRANSLATE_LANGS = { de: 'Deutsch' };
const MAX_TR_INGREDIENTS = 60;
const MAX_TR_STEPS = 40;
const MAX_TR_TITLE = 200;
const MAX_TR_INGREDIENT_CHARS = 120;
const MAX_TR_STEP_CHARS = 1200;
const MAX_TR_QUERY_CHARS = 120;

function textList(value, maxItems, maxChars, name) {
  if (!Array.isArray(value)) throw new ClientError(400, `${name} ungültig.`);
  if (value.length > maxItems) throw new ClientError(400, `${name}: zu viele Einträge.`);
  return value.map((v) => text(v, maxChars));
}

function validateTranslateRequest(p) {
  const title = text(p.title, MAX_TR_TITLE);
  if (!title) throw new ClientError(400, 'Titel fehlt.');
  return {
    lang: oneOf(p.lang ?? 'de', Object.keys(TRANSLATE_LANGS), 'Sprache'),
    title,
    ingredients: textList(p.ingredients, MAX_TR_INGREDIENTS, MAX_TR_INGREDIENT_CHARS, 'Zutaten'),
    steps: textList(p.steps, MAX_TR_STEPS, MAX_TR_STEP_CHARS, 'Schritte'),
  };
}

function validateQueryTranslateRequest(p) {
  const query = text(p.query, MAX_TR_QUERY_CHARS);
  if (!query) throw new ClientError(400, 'Suchbegriff fehlt.');
  return { lang: oneOf(p.lang ?? 'de', Object.keys(TRANSLATE_LANGS), 'Sprache'), query };
}

// ── SSRF-Schutz + Seitentext ───────────────────────────────────────────

function isPrivateIPv4(host) {
  const [a, b] = host.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 198 && (b === 18 || b === 19))
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
  if (u.port && !ALLOWED_PORTS.has(u.port)) return false; // keine Dienste auf Nicht-Standard-Ports
  // Trailing Dot ("localhost.", "127.0.0.1.") ist ein gültiger FQDN und würde sonst den Filter umgehen.
  const host = u.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host) return false;
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home)$/.test(host)) return false;
  if (host.startsWith('[') || host.includes(':')) return false; // alle IPv6-Literale (inkl. IPv4-mapped)
  // Die URL-Klasse normalisiert Dezimal-/Hex-/Oktal-IPs (2130706433, 0x7f.1) zu Dotted-Quad.
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

/**
 * Unterscheidet blockierte, leere und nicht lesbare Antworten von "überlastet":
 * das sind Eingabe-/Antwortprobleme (422), kein Serverausfall (503).
 */
function extractAnswer(data) {
  const candidate = data?.candidates?.[0];
  const blocked = data?.promptFeedback?.blockReason || BLOCKING_FINISH_REASONS.has(candidate?.finishReason);
  const answer = candidate?.content?.parts?.[0]?.text ?? '';
  if (blocked && !answer) {
    console.warn('Gemini-Antwort blockiert:', data?.promptFeedback?.blockReason ?? candidate?.finishReason);
    throw new ClientError(422, BLOCKED_MESSAGE);
  }
  if (!answer) {
    console.warn('Gemini-Antwort leer, finishReason:', candidate?.finishReason);
    throw new ClientError(422, EMPTY_ANSWER_MESSAGE);
  }
  return answer;
}

async function gemini(prompt, env, imageBase64 = null, { maxOutputTokens = TOKENS_LIST, temperature = 0, responseSchema = null } = {}) {
  const parts = imageBase64
    ? [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }]
    : [{ text: prompt }];
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature,
      maxOutputTokens,
      ...(responseSchema ? { responseSchema } : {}),
      // Optional (Worker-Variable GEMINI_THINKING_LEVEL, z. B. "low"): weniger Denkzeit bei reiner Extraktion.
      ...(env.GEMINI_THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: env.GEMINI_THINKING_LEVEL } } : {}),
    },
  });
  const resp = await geminiWithFallback(body, env);

  const answer = extractAnswer(await resp.json());

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
    console.warn('Gemini-Antwort kein JSON:', answer.slice(0, 200));
    throw new ClientError(422, EMPTY_ANSWER_MESSAGE);
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
  return gemini(prompt, env, null, { maxOutputTokens: TOKENS_LIST });
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
  return gemini(prompt, env, req.imageBase64, { maxOutputTokens: TOKENS_LABEL });
}

/** Kriterien als Text: neue Liste, sonst das alte Einzelfeld, sonst proteinreich. */
function fastfoodCriteria(req) {
  if (req.preferences.length > 0) return req.preferences.join('; ');
  return req.preference || 'proteinreich';
}

async function suggestFastfood(req, env) {
  const exclude = req.exclude.length > 0 ? `Diese Produkte wurden schon vorgeschlagen und dürfen NICHT erneut vorkommen: ${req.exclude.join('; ')}.` : '';
  const prompt = `Du bist ein Ernährungs-Coach. Schlage 3 Fastfood-Optionen vor.
Restaurant: ${req.restaurant || 'beliebig'}.
Land: ${req.country}. Nenne nur Produkte, die es in ${req.country} bei diesem Restaurant gibt; Preise in der Landeswährung als EUR-Schätzung.
Kalorienbudget: ${req.kcalBudget} kcal.
${req.moneyBudget ? `Geldbudget: ${req.moneyBudget} €.` : ''}
Kriterien (alle gleichzeitig berücksichtigen): ${fastfoodCriteria(req)}.
${exclude}

Antworte NUR mit gültigem JSON-Array:
[{
  "restaurant": "string",
  "itemName": "string",
  "facts": {"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"basis":"perPortion"},
  "rationale": "string",
  "estPrice": number
}]`;
  return gemini(prompt, env, null, { maxOutputTokens: TOKENS_FASTFOOD });
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
  return gemini(`${prompt}\n\n${IMPORT_SCHEMA}`, env, req.imageBase64 ?? null, { maxOutputTokens: TOKENS_IMPORT });
}

// ── Übersetzung (Rezepte, Suchbegriffe) ────────────────────────────────

const TRANSLATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'ingredients', 'steps'],
};

const QUERY_SCHEMA = {
  type: 'OBJECT',
  properties: { query: { type: 'STRING' } },
  required: ['query'],
};

/** Gleich viele Einträge wie die Eingabe; leere oder fehlende Übersetzungen fallen auf das Original zurück. */
function alignList(translated, source) {
  if (!Array.isArray(translated) || translated.length !== source.length) return [...source];
  return source.map((orig, i) => {
    const t = typeof translated[i] === 'string' ? translated[i].trim() : '';
    return t || orig;
  });
}

async function translateRecipe(req, env) {
  const language = TRANSLATE_LANGS[req.lang];
  const prompt = `Übersetze dieses englische Rezept ins ${language}.
Regeln:
- "title": übersetzter Titel.
- "ingredients": gleiche Anzahl und Reihenfolge wie die Eingabe. Jeder Eintrag ist ein Zutatenname in der Einkaufs-Grundform:
  ohne Mengen, Zubereitungswörter und Marken, Einzahl wo üblich (z. B. "pork shoulder" -> "Schweineschulter",
  "chopped fresh rosemary" -> "Rosmarin, frisch", "2 cloves garlic, minced" -> "Knoblauch").
- "steps": gleiche Anzahl und Reihenfolge, natürliches ${language}, Zahlen, Temperaturen und Zeiten unverändert lassen.
Antworte NUR mit gültigem JSON.

Titel: ${req.title}
Zutaten:
${req.ingredients.map((n, i) => `${i + 1}. ${n}`).join('\n')}
Schritte:
${req.steps.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  const out = await gemini(prompt, env, null, {
    maxOutputTokens: TOKENS_TRANSLATE,
    temperature: 0,
    responseSchema: TRANSLATE_SCHEMA,
  });
  return {
    title: typeof out?.title === 'string' && out.title.trim() ? out.title.trim() : req.title,
    ingredients: alignList(out?.ingredients, req.ingredients),
    steps: alignList(out?.steps, req.steps),
  };
}

async function translateSearchQuery(req, env) {
  const prompt = `Übersetze diesen Suchbegriff für eine Rezeptdatenbank (${TRANSLATE_LANGS[req.lang]}) ins Englische. Nur die Übersetzung, keine Erklärung. Ist er schon Englisch, gib ihn unverändert zurück.
Suchbegriff: ${req.query}`;
  const out = await gemini(prompt, env, null, {
    maxOutputTokens: TOKENS_QUERY,
    temperature: 0,
    responseSchema: QUERY_SCHEMA,
  });
  const query = typeof out?.query === 'string' ? out.query.trim().slice(0, MAX_TR_QUERY_CHARS) : '';
  return { query: query || req.query };
}
