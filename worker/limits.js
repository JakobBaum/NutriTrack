import { errorSummary, hasBinding, json } from './http.js';

const DEFAULT_DAILY_CAP = 2000;

// Spoonacular-Gratisplan: laut docs/KI-WORKER.md ca. 50 Punkte pro Tag; bewusst darunter bleiben.
const DEFAULT_DAILY_RECIPE_CAP = 40;

const DAILY_KEY_TTL_S = 2 * 86400;

const DAILY_LIMIT_MESSAGE = 'Das Tageslimit für KI-Anfragen ist erreicht — bitte morgen erneut versuchen.';

const DAILY_UNAVAILABLE_MESSAGE = 'Der Tageszähler für KI-Anfragen ist gerade nicht erreichbar — bitte später erneut versuchen.';

const RECIPE_DAILY_LIMIT_MESSAGE = 'Das Tageslimit für Rezeptsuchen ist erreicht — bitte morgen erneut versuchen.';

const RECIPE_DAILY_UNAVAILABLE_MESSAGE = 'Der Tageszähler für Rezeptsuchen ist gerade nicht erreichbar — bitte später erneut versuchen.';

const DAILY_LIMIT_RETRY_AFTER_S = '3600';

const DAILY_UNAVAILABLE_RETRY_AFTER_S = '60';

const RATE_LIMIT_RETRY_AFTER_S = '60';

// Tageszähler (UTC) je Kostenstelle: KI-Aufrufe (Gemini) und Rezeptsuchen (Spoonacular) zählen getrennt.
export const AI_COUNTER = {
  keyPrefix: 'cap', capVar: 'DAILY_AI_CAP', defaultCap: DEFAULT_DAILY_CAP,
  limitMessage: DAILY_LIMIT_MESSAGE, unavailableMessage: DAILY_UNAVAILABLE_MESSAGE,
};

export const RECIPE_COUNTER = {
  keyPrefix: 'recipecap', capVar: 'DAILY_RECIPE_CAP', defaultCap: DEFAULT_DAILY_RECIPE_CAP,
  limitMessage: RECIPE_DAILY_LIMIT_MESSAGE, unavailableMessage: RECIPE_DAILY_UNAVAILABLE_MESSAGE,
};

const IPV6_GROUPS = 8;

const IPV6_PREFIX_GROUPS = 4; // /64

/** Alle 8 Gruppen einer IPv6-Adresse (mit "::" aufgefüllt); null bei unlesbarer Form. */
function ipv6Groups(ip) {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const [left, right] = halves.map((h) => (h ? h.split(':') : []));
  const missing = IPV6_GROUPS - left.length - (right?.length ?? 0);
  if (right === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array(right === undefined ? 0 : missing).fill('0'), ...(right ?? [])]
    .map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? Number.parseInt(g, 16) : -1));
  return groups.every((g) => g >= 0) ? groups : null;
}

/**
 * Schlüssel für das Rate-Limit: IPv4 unverändert, IPv6 auf das /64-Präfix gekürzt
 * (ein Anschluss bekommt meist ein ganzes /64; sonst würde Adress-Rotation das Limit umgehen).
 */
export function rateLimitKey(ip) {
  if (!ip) return 'unknown';
  if (!ip.includes(':') || ip.includes('.')) return ip;
  const groups = ipv6Groups(ip);
  if (!groups) return ip;
  return `${groups.slice(0, IPV6_PREFIX_GROUPS).map((g) => g.toString(16)).join(':')}::/64`;
}

export async function isRateLimited(limiter, request) {
  if (!hasBinding(limiter, 'limit')) return false;
  const key = rateLimitKey(request.headers.get('CF-Connecting-IP'));
  const { success } = await limiter.limit({ key });
  return !success;
}

export function rateLimitedResponse(message, cors) {
  return json({ error: message }, 429, { ...cors, 'Retry-After': RATE_LIMIT_RETRY_AFTER_S });
}

/**
 * Globaler Tageszähler (UTC) über KV. Ergebnis: 'ok' | 'limit' (Deckel erreicht) | 'unavailable'.
 * Ohne Binding: fail-open ('ok', kein Deckel).
 * Binding konfiguriert, KV aber nicht erreichbar: fail-closed ('unavailable'), damit ein
 * KV-Ausfall den Kostenschutz nicht aushebelt; ein nicht numerischer Zählerwert gilt ebenso als 'unavailable'. KV ist nicht atomar, bei gleichzeitigen
 * Anfragen kann der Deckel daher knapp überschritten werden.
 * `weight` = Gewicht des Aufrufs (Foto-Aufrufe zählen doppelt).
 */
export async function takeDailySlot(env, weight = 1, counter = AI_COUNTER) {
  if (!hasBinding(env.DAILY_KV, 'get')) return 'ok';
  const parsedCap = Number.parseInt(env[counter.capVar] ?? '', 10);
  const cap = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : counter.defaultCap;
  const key = `${counter.keyPrefix}:${new Date().toISOString().slice(0, 10)}`;
  try {
    const stored = await env.DAILY_KV.get(key);
    const used = stored === null || stored === undefined ? 0 : Number(stored);
    if (!Number.isInteger(used) || used < 0) {
      // Kaputter Zähler: nicht bei 0 neu beginnen (der Deckel wäre ausgehebelt), sondern wie bei KV-Ausfall ablehnen.
      console.error('Tageszähler (KV) enthält keinen gültigen Wert — Aufruf wird abgelehnt.');
      return 'unavailable';
    }
    if (used + weight > cap) return 'limit';
    await env.DAILY_KV.put(key, String(used + weight), { expirationTtl: DAILY_KEY_TTL_S });
    return 'ok';
  } catch (e) {
    console.error('Tageszähler (KV) nicht verfügbar — Aufruf wird abgelehnt:', errorSummary(e));
    return 'unavailable';
  }
}

/** Antwort für 'limit' (429) bzw. 'unavailable' (503); null bei 'ok'. */
export function dailySlotResponse(slot, counter, cors) {
  if (slot === 'limit') {
    return json({ error: counter.limitMessage }, 429, { ...cors, 'Retry-After': DAILY_LIMIT_RETRY_AFTER_S });
  }
  if (slot === 'unavailable') {
    return json({ error: counter.unavailableMessage }, 503, { ...cors, 'Retry-After': DAILY_UNAVAILABLE_RETRY_AFTER_S });
  }
  return null;
}
