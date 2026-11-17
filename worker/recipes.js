import { MAX_QUERY_CHARS, errorSummary, json, withHeaders } from './http.js';
import { RECIPE_COUNTER, dailySlotResponse, isRateLimited, rateLimitedResponse, takeDailySlot } from './limits.js';

const SPOONACULAR_BASE = 'https://api.spoonacular.com/recipes';

const SPOONACULAR_URL = `${SPOONACULAR_BASE}/complexSearch`;

// Gleiches Muster wie RECIPE_ID_PATTERN in spoonacular.provider.ts.
const RECIPE_ID_PATTERN = /^\d{1,12}$/;

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

const RECIPE_CACHE_TTL_S = 3600; // Spoonacular-Bedingungen: Cache höchstens 1 Stunde

const RECIPE_FAILURE_HEADERS = ['Retry-After'];

const RECIPE_UPSTREAM_FAILED = 'Rezept-Suche ist gerade nicht erreichbar.';

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
  // Nur der Inhalt wird gecacht: der Quota-Header gehört zum Live-Aufruf und gehört nicht an andere Nutzer.
  const headers = { 'Content-Type': resp.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': `public, max-age=${RECIPE_CACHE_TTL_S}` };
  try {
    await cache.put(cacheKey, new Response(body, { status: 200, headers }));
  } catch (e) {
    console.warn('Rezept-Cache nicht beschreibbar:', errorSummary(e));
  }
}

export async function recipeSearch(request, url, env, cors) {
  if (!env.SPOONACULAR_API_KEY) return json({ error: RECIPE_NOT_CONFIGURED }, 503, cors);
  return fetchSpoonacular(request, buildRecipeUrl(url), env, cors);
}

/** Einzelrezept (Zutaten, Anleitung, Nährwerte): nur die ID und includeNutrition=true gehen an Spoonacular. */
export async function recipeInformation(request, url, id, env, cors) {
  if (!RECIPE_ID_PATTERN.test(id)) return json({ error: 'Rezept-ID ungültig.' }, 400, cors);
  if (!env.SPOONACULAR_API_KEY) return json({ error: RECIPE_NOT_CONFIGURED }, 503, cors);
  const target = new URL(`${SPOONACULAR_BASE}/${id}/information`);
  if (url.searchParams.get('includeNutrition') === 'true') target.searchParams.set('includeNutrition', 'true');
  return fetchSpoonacular(request, target, env, cors);
}

/** Upstream-Fehler: Statuscode (der Client wertet 402/404/429 aus) und Retry-After bleiben, der Upstream-Text nicht. */
function upstreamFailure(resp, cors) {
  console.warn(`Spoonacular antwortet mit HTTP ${resp.status}.`);
  const headers = { ...cors };
  for (const name of RECIPE_FAILURE_HEADERS) {
    const value = resp.headers.get(name);
    if (value) headers[name] = value;
  }
  return json({ error: RECIPE_UPSTREAM_FAILED }, resp.status, headers);
}

/** Cache, Rate-Limit, Tagesdeckel und Upstream-Aufruf; Fehlerstatus (auch 404) gehen unverändert durch. */
async function fetchSpoonacular(request, target, env, cors) {
  // Der API-Key steht im Header, nicht in der URL → die URL ist ein sicherer Cache-Key.
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(target.toString());
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return withHeaders(cached, cors);
  if (await isRateLimited(env.AI_LIMITER, request)) {
    return rateLimitedResponse('Zu viele Anfragen — bitte kurz warten.', cors);
  }
  // Nur Cache-Misses kosten Spoonacular-Punkte → nur sie zählen gegen den Tagesdeckel.
  const blocked = dailySlotResponse(await takeDailySlot(env, 1, RECIPE_COUNTER), RECIPE_COUNTER, cors);
  if (blocked) return blocked;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);
  try {
    const resp = await fetch(target.toString(), {
      headers: { 'x-api-key': env.SPOONACULAR_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    // Ungültiger/gesperrter Server-Key ist kein Fehler des Nutzers.
    if (resp.status === 401 || resp.status === 403) return json({ error: RECIPE_UNAVAILABLE }, 502, cors);
    if (!resp.ok) return upstreamFailure(resp, cors);
    const body = await resp.text();
    if (cache) await cacheRecipeResponse(cache, cacheKey, body, resp);
    return new Response(body, { status: resp.status, headers: recipeResponseHeaders(resp, cors) });
  } catch (e) {
    if (e?.name === 'AbortError') return json({ error: RECIPE_TIMEOUT_MESSAGE }, 504, cors);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
