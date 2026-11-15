import { ClientError, FETCH_TIMEOUT_MS, errorSummary } from './http.js';
import { PAGE_AGENT_NAME, robotsAllows } from './robots.js';
import { fetchFollowingRedirects, parseImportUrl, readCapped } from './ssrf.js';

const PAGE_USER_AGENT = `${PAGE_AGENT_NAME}/1.0 (+https://jakobbaum.github.io/NutriTrack/)`;

// Plattformen, deren Bedingungen automatisiertes Auslesen untersagen (jeweils samt Subdomains).
const BLOCKED_PAGE_HOSTS = ['tiktok.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com'];

const PAGE_NOT_ALLOWED_MESSAGE = 'Von dieser Seite können wir keine Rezepte abrufen. Kopiere den Rezepttext und füge ihn ein.';

const PAGE_NOT_ALLOWED_STATUS = 422;

const ROBOTS_TIMEOUT_MS = 5000;

const ROBOTS_MAX_BYTES = 512 * 1024; // RFC 9309: mindestens 500 KiB auswerten

const MAX_PAGE_BYTES = 1024 * 1024;

const MAX_PROMPT_PAGE_CHARS = 12000;

function normalizedHost(raw) {
  return parseImportUrl(raw).hostname.toLowerCase().replace(/\.+$/, '');
}

/** Host-Vergleich (kein Teilstring): "tiktok.com" und "*.tiktok.com", nicht "nottiktok.com". */
function isBlockedPageHost(raw) {
  const host = normalizedHost(raw);
  return BLOCKED_PAGE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function pageNotAllowed() {
  return new ClientError(PAGE_NOT_ALLOWED_STATUS, PAGE_NOT_ALLOWED_MESSAGE);
}

/**
 * Darf die Seite abgerufen werden? robots.txt vom selben Ursprung (gleicher SSRF-Schutz, auch bei Weiterleitungen).
 * 2xx: auswerten. 4xx: nicht vorhanden, erlaubt. 5xx, Netzfehler, Zeitüberschreitung, abgelehnte Weiterleitung,
 * zu viele Weiterleitungen: gesperrt (RFC 9309, bewusst konservativ).
 */
async function isAllowedByRobots(pageUrl) {
  const target = parseImportUrl(pageUrl);
  try {
    const resp = await fetchFollowingRedirects(`${target.origin}/robots.txt`, {
      headers: { 'User-Agent': PAGE_USER_AGENT, Accept: 'text/plain' },
      timeoutMs: ROBOTS_TIMEOUT_MS,
    });
    if (resp.status >= 500) return false;
    if (!resp.ok) return true;
    return robotsAllows(await readCapped(resp, ROBOTS_MAX_BYTES), `${target.pathname}${target.search}`);
  } catch (e) {
    console.warn('robots.txt nicht abrufbar — Abruf wird nicht durchgeführt:', errorSummary(e));
    return false;
  }
}

async function assertPageAllowed(url) {
  if (isBlockedPageHost(url) || !(await isAllowedByRobots(url))) throw pageNotAllowed();
}

/** Holt eine Rezeptseite (Sperrliste und robots.txt je Station, SSRF-Schutz je Weiterleitung). */
export async function fetchPublicPage(startUrl) {
  const resp = await fetchFollowingRedirects(startUrl, {
    headers: { 'User-Agent': PAGE_USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain' },
    timeoutMs: FETCH_TIMEOUT_MS,
    beforeHop: assertPageAllowed,
  });
  if (!resp.ok) throw new ClientError(422, `Rezeptseite antwortet mit HTTP ${resp.status}.`);
  const type = resp.headers.get('Content-Type') ?? '';
  if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
    throw new ClientError(422, 'Link zeigt auf keine Webseite.');
  }
  return readCapped(resp, MAX_PAGE_BYTES);
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
export function extractRecipeText(html) {
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
