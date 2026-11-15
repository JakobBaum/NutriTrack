import { ClientError } from './http.js';

const ALLOWED_PORTS = new Set(['80', '443']);

const MAX_REDIRECTS = 3;

const INVALID_IMPORT_URL_MESSAGE = 'Diese URL kann nicht importiert werden.';

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
export function isPublicHttpUrl(raw) {
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

export async function readCapped(resp, maxBytes) {
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

/** `new URL` mit 400 statt TypeError (z. B. kaputter Location-Header einer Weiterleitung). */
export function parseImportUrl(raw, base) {
  try {
    return new URL(raw, base);
  } catch {
    throw new ClientError(400, INVALID_IMPORT_URL_MESSAGE);
  }
}

/**
 * Holt eine URL und folgt Weiterleitungen manuell: jede Station wird erneut gegen SSRF geprüft.
 * `beforeHop(url)` darf werfen, um eine Station abzulehnen (Sperrliste, robots.txt).
 */
export async function fetchFollowingRedirects(startUrl, { headers, timeoutMs, beforeHop }) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpUrl(current)) throw new ClientError(400, 'Diese URL kann nicht importiert werden.');
    if (beforeHop) await beforeHop(current);
    const resp = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const location = resp.headers.get('Location');
    if (resp.status >= 300 && resp.status < 400 && location) {
      current = parseImportUrl(location, current).toString();
      continue;
    }
    return resp;
  }
  throw new ClientError(422, 'Zu viele Weiterleitungen.');
}
