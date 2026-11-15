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

export async function isRateLimited(limiter, request) {
  if (!hasBinding(limiter, 'limit')) return false;
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
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
 * KV-Ausfall den Kostenschutz nicht aushebelt. KV ist nicht atomar, bei gleichzeitigen
 * Anfragen kann der Deckel daher knapp überschritten werden.
 * `weight` = Gewicht des Aufrufs (Foto-Aufrufe zählen doppelt).
 */
export async function takeDailySlot(env, weight = 1, counter = AI_COUNTER) {
  if (!hasBinding(env.DAILY_KV, 'get')) return 'ok';
  const parsedCap = Number.parseInt(env[counter.capVar] ?? '', 10);
  const cap = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : counter.defaultCap;
  const key = `${counter.keyPrefix}:${new Date().toISOString().slice(0, 10)}`;
  try {
    const used = Number(await env.DAILY_KV.get(key)) || 0;
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
