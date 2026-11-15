import { ClientError, FETCH_TIMEOUT_MS, MAX_QUERY_CHARS, errorSummary, withHeaders } from './http.js';
import { isRateLimited, rateLimitedResponse } from './limits.js';

const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';

// OFF verlangt einen User-Agent mit App-Name + Kontakt (Browser dürfen ihn nicht setzen).
const OFF_USER_AGENT = 'NutriTrack/1.0 (+https://github.com/JakobBaum/NutriTrack)';

const SEARCH_PARAMS = ['q', 'page', 'page_size', 'fields', 'langs', 'sort_by'];

const MAX_PAGE_SIZE = 50;

const DEFAULT_PAGE_SIZE = 12;

const MAX_SEARCH_PAGE = 1000;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const INTEGER_PATTERN = /^\d{1,6}$/;

const INVALID_SEARCH_PARAM_MESSAGE = 'Suchparameter ungültig.';

// Zeichensatz und Länge der Textparameter (Werte der App: fields-Liste, langs "de,en"; sort_by z. B. "-unique_scans_n").
const SEARCH_TEXT_RULES = {
  fields: { pattern: /^[a-z0-9_,]+$/i, maxChars: 200 },
  langs: { pattern: /^[a-z]{2}(,[a-z]{2})*$/i, maxChars: 50 },
  sort_by: { pattern: /^-?[a-z0-9_]+$/i, maxChars: 50 },
};

const SEARCH_CACHE_TTL_S = 3600;

function invalidSearchParam() {
  return new ClientError(400, INVALID_SEARCH_PARAM_MESSAGE);
}

/** Ganzzahl im Bereich [min, max] aus einem Query-Wert; sonst 400. */
function searchInteger(value, min, max) {
  if (!INTEGER_PATTERN.test(value)) throw invalidSearchParam();
  const n = Number(value);
  if (n < min || n > max) throw invalidSearchParam();
  return n;
}

/** Prüft einen Parameter und liefert den Wert für OFF; ungültige Werte werden abgelehnt, nicht korrigiert. */
function validatedSearchValue(key, value, q) {
  if (key === 'q') return q;
  if (key === 'page') return String(searchInteger(value, 1, MAX_SEARCH_PAGE));
  // page_size wird nach oben begrenzt (Abwärtskompatibilität), muss aber eine Zahl sein.
  if (key === 'page_size') return String(Math.min(Math.max(1, searchInteger(value, 0, Number.MAX_SAFE_INTEGER)), MAX_PAGE_SIZE));
  const rule = SEARCH_TEXT_RULES[key];
  if (value.length > rule.maxChars || !rule.pattern.test(value)) throw invalidSearchParam();
  return value;
}

function buildSearchUrl(url) {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) throw new ClientError(400, 'Suchbegriff fehlt.');
  if (q.length > MAX_QUERY_CHARS) throw new ClientError(400, 'Suchbegriff zu lang.');
  if (CONTROL_CHARS.test(q)) throw new ClientError(400, 'Suchbegriff ungültig.');

  const target = new URL(OFF_SEARCH_URL);
  for (const key of SEARCH_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) target.searchParams.set(key, validatedSearchValue(key, value, q));
  }
  if (!target.searchParams.has('page_size')) target.searchParams.set('page_size', String(DEFAULT_PAGE_SIZE));
  return target;
}

export async function offSearch(request, url, env, cors) {
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
    try {
      await cache.put(cacheKey, toCache);
    } catch (e) {
      console.warn('OFF-Cache nicht beschreibbar:', errorSummary(e));
    }
  }
  return new Response(body, { status: resp.status, headers: { ...passthrough, ...cors } });
}
