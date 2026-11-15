import { ClientError, OverloadedError } from './http.js';

// Standard für Textaufgaben: schnell und günstig.
const GEMINI_FAST_MODEL = 'gemini-3.5-flash-lite';

// Für Fotos und Rezeptimport (opts.strong): genauer, aber langsamer und teurer.
const GEMINI_STRONG_MODEL = 'gemini-3.6-flash';

const GEMINI_RETRIES = 1; // zusätzliche Versuche pro Modell bei 500/503/429

const GEMINI_BACKOFF_BASE_MS = 600;

const GEMINI_TOTAL_BUDGET_MS = 25000; // Gesamtzeit über alle Versuche

const GEMINI_ATTEMPT_TIMEOUT_MS = 12000;

export const GEMINI_RETRY_AFTER_S = 60;

export const OVERLOADED_MESSAGE = 'Die KI ist gerade überlastet — bitte in einer Minute erneut versuchen.';

const TRANSIENT_STATUSES = new Set([429, 500, 503]);

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const BLOCKED_MESSAGE = 'Die KI hat diese Anfrage aus Sicherheitsgründen abgelehnt.';

const EMPTY_ANSWER_MESSAGE = 'Die KI hat keine verwertbare Antwort geliefert — bitte erneut versuchen.';

const BLOCKING_FINISH_REASONS = new Set(['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

// Strukturierte Aufgaben: deterministisch (temperature 0) und mit Ausgabe-Obergrenze (Kostenschutz).
export const TOKENS_LABEL = 1024;

export const TOKENS_LIST = 4096;

export const TOKENS_FASTFOOD = 2048;

export const TOKENS_MEAL = 3072;

export const TOKENS_IMPORT = 8192;

export const TOKENS_TRANSLATE = 4096;

export const TOKENS_QUERY = 128;

/** Leere oder nicht lesbare Antwort: Anlass, einmal das andere Modell zu fragen. */
class UnusableAnswerError extends ClientError {
  constructor() {
    super(422, EMPTY_ANSWER_MESSAGE);
  }
}

const sleep =(ms) => new Promise((r) => setTimeout(r, ms));

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
 * Erstes Modell mit Retry (Backoff + Jitter, innerhalb des Gesamtbudgets),
 * danach das jeweils andere als Fallback. Gibt die erste erfolgreiche Response zurück;
 * bleibt alles transient kaputt → OverloadedError, sonst Error mit Status.
 */
/** Reihenfolge der Modelle: das zur Aufgabe passende zuerst, das andere als Fallback. Per Worker-Variable überschreibbar. */
function modelOrder(env, strong) {
  const fast = env.GEMINI_FAST_MODEL || GEMINI_FAST_MODEL;
  const strongModel = env.GEMINI_STRONG_MODEL || GEMINI_STRONG_MODEL;
  return strong ? [strongModel, fast] : [fast, strongModel];
}

async function geminiWithFallback(body, models, env, deadline) {
  let lastTransient = false;
  let lastError = null;
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
        lastError = Object.assign(new Error(`Gemini ${resp.status}: ${msg}`), { upstreamStatus: resp.status });
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
    throw new UnusableAnswerError();
  }
  return answer;
}

export async function gemini(prompt, env, imageBase64 = null, { maxOutputTokens = TOKENS_LIST, temperature = 0, responseSchema = null, strong = false } = {}) {
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
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
  const [first, second] = modelOrder(env, strong);
  try {
    return await askForJson(body, [first, second], env, deadline);
  } catch (e) {
    // Leere oder nicht lesbare Antwort: einmal das andere Modell fragen, im selben Zeitbudget.
    if (!(e instanceof UnusableAnswerError) || second === first) throw e;
    return askForJson(body, [second], env, deadline);
  }
}

async function askForJson(body, models, env, deadline) {
  const resp = await geminiWithFallback(body, models, env, deadline);
  return parseJsonAnswer(extractAnswer(await resp.json()));
}

function parseJsonAnswer(answer) {
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
    console.warn('Gemini-Antwort kein JSON, Länge:', answer.length);
    throw new UnusableAnswerError();
  }
}
