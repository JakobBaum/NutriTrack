/** Fehler, die als 4xx an den Client gehen (Eingabe ist schuld, nicht der Server). */
export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Gemini dauerhaft überlastet/limitiert → 503 mit Retry-After statt 500. */
export class OverloadedError extends Error {}

export const GENERIC_ERROR_MESSAGE = 'Interner Fehler.';

export const MAX_QUERY_CHARS = 200;

export const FETCH_TIMEOUT_MS = 10000;

export function hasBinding(binding, method) {
  return typeof binding?.[method] === 'function';
}

/** Nur Art des Fehlers (und Upstream-Status) fürs Log: Meldungen können Nutzereingaben oder Schlüssel enthalten. */
export function errorSummary(e) {
  const status = Number.isInteger(e?.upstreamStatus) ? ` (Upstream-HTTP ${e.upstreamStatus})` : '';
  return `${e?.name ?? typeof e}${status}`;
}

export function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

/** Liest den Body mit hartem Byte-Limit (auch ohne/mit falschem Content-Length). */
export async function readBodyCapped(request, maxBytes) {
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
