/**
 * NutriTrack Cloudflare Worker
 * - GET  /off-search  → OpenFoodFacts-Suche (CORS-Proxy, 1 h gecacht)
 * - GET  /recipes/complexSearch → spoonacular-Rezeptsuche (Key nur als Secret SPOONACULAR_API_KEY)
 * - GET  /recipes/:id/information → spoonacular-Einzelrezept (nur includeNutrition)
 * - POST /            → KI-Proxy für Gemini (fn + payload)
 *
 * - GET  /health      → Statusprüfung {ok: true} (bewusst ohne Konfigurationsdetails)
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
 *                    (ohne Binding: kein Deckel;
 *                    mit Binding aber KV-Ausfall: fail-closed, 503; Foto-Aufrufe zählen doppelt)
 *   DAILY_AI_CAP     Deckel pro UTC-Tag (Standard 2000)
 *   DAILY_RECIPE_CAP Deckel für Rezeptsuchen pro UTC-Tag, getrennt gezählt, Cache-Treffer zählen nicht (Standard 40)
 *   REQUIRE_ORIGIN   "true": Anfragen ohne Origin ablehnen (403), außer GET /health und OPTIONS (Standard: aus,
 *                    die native iOS-App sendet mit CapacitorHttp keinen Origin)
 *
 * Aufbau: Einstieg + Routing hier, Module unter worker/ (wrangler bündelt sie per esbuild).
 *
 * Sicherheit: Origin-Allowlist, Payload-Validierung + Größenlimits, Rate-Limit pro IP,
 * globaler Tagesdeckel, SSRF-Schutz beim Rezept-Import, Key nur als Header,
 * generische Fehlermeldungen an den Client (Details nur im Log). Der Proxy ist
 * öffentlich erreichbar (Origin lässt sich außerhalb von Browsern fälschen) —
 * Rate-Limit und Tagesdeckel sind der eigentliche Kostenschutz.
 */

import { aiProxy } from './worker/ai.js';
import { GEMINI_RETRY_AFTER_S, OVERLOADED_MESSAGE } from './worker/gemini.js';
import { ClientError, GENERIC_ERROR_MESSAGE, OverloadedError, errorSummary, json } from './worker/http.js';
import { offSearch } from './worker/off.js';
import { corsHeaders, isOriginRejected } from './worker/origin.js';
import { recipeInformation, recipeSearch } from './worker/recipes.js';

/** Öffentlich erreichbar: verrät bewusst keine Konfiguration (Schlüssel, Bindings, Modelle). */
function healthStatus() {
  return { ok: true };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (isOriginRejected(origin, request, env)) {
      return json({ error: origin ? 'Origin nicht erlaubt.' : 'Origin fehlt.' }, 403);
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
      const detail = request.method === 'GET' ? /^\/recipes\/([^/]+)\/information$/.exec(url.pathname) : null;
      if (detail) return await recipeInformation(request, url, detail[1], env, cors);
      if (request.method === 'GET' && url.pathname === '/health') {
        return json(healthStatus(), 200, cors);
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
      console.error('Worker-Fehler:', errorSummary(e));
      return json({ error: GENERIC_ERROR_MESSAGE }, 500, cors);
    }
  },
};
