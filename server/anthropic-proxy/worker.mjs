/**
 * NutriTrack KI-Proxy (serverless, host-agnostisch `fetch`-Handler).
 *
 * Zweck: EIN interner Anthropic-API-Key für ALLE App-Nutzer. Der Key liegt
 * ausschließlich serverseitig in der Umgebungsvariable `ANTHROPIC_API_KEY` —
 * niemals im Client. Die App ruft nur diesen Proxy, die System-Prompts sind
 * hier fix hinterlegt und pro Funktion gewählt. Modell-Routing: günstiges
 * Haiku als Standard, Sonnet nur für Vision (Etikett).
 *
 * Deploy: Cloudflare Workers (`wrangler deploy`), Vercel Edge oder Node.
 * Siehe README.md. CORS ist offen (öffentliche App) — bei Bedarf ALLOWED_ORIGIN
 * in der Umgebung setzen, um auf die eigene Domain zu beschränken.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_LIGHT = 'claude-haiku-4-5-20251001';
const MODEL_VISION = 'claude-sonnet-4-6';

// Fixe System-Prompts je Funktion (serverseitig, für alle Nutzer identisch).
const PROMPTS = {
  computeTargets:
    'Du bist Ernährungsrechner. Antworte NUR mit JSON: ' +
    '{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number}. ' +
    'Nutze Mifflin-St Jeor + Aktivitätsfaktor + Ziel-Anpassung. Keine Erklärung.',
  generateShoppingList:
    'Du erstellst Einkaufslisten. Antworte NUR mit JSON: ' +
    '{"items":[{"name":string,"amount":number,"unit":string,"estPrice":number}],' +
    '"suggestedDishes":[string],"estTotal":number,"note":string}. ' +
    'Fasse gleiche Zutaten zusammen. estPrice/estTotal in EUR (Schätzung für den Markt). ' +
    'Bleibe möglichst im Budget. Nutze vorhandene Rezepte, ergänze sonst sinnvoll.',
  recognizeLabel:
    'Du liest Nährwert-Etiketten. Antworte NUR mit JSON: ' +
    '{"name":string,"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,' +
    '"fiberG":number,"sugarG":number}.',
  suggestFastfood:
    'Du empfiehlst Fastfood-Optionen. Antworte NUR mit JSON-Array: ' +
    '[{"restaurant":string,"itemName":string,"kcal":number,"proteinG":number,' +
    '"carbsG":number,"fatG":number,"rationale":string,"estPrice":number}]. ' +
    'Priorisiere proteinreiche Optionen mit gutem Verhältnis, bleibe im kcal-/Geld-Budget.',
};

const MAX_TOKENS = {
  computeTargets: 400,
  generateShoppingList: 1500,
  recognizeLabel: 500,
  suggestFastfood: 800,
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'content-type': 'application/json',
  };
}

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Robustes JSON aus der Modellantwort (strippt ```-Fences, matcht erstes Objekt/Array). */
function extractJson(text) {
  const trimmed = (text ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/[[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('KI-Antwort war kein gültiges JSON.');
  }
}

/** Baut den User-Content je Funktion (Text oder Vision-Blöcke). */
function buildContent(fn, payload) {
  if (fn === 'recognizeLabel') {
    const basis = payload?.basis === 'perPortion' ? 'eine Portion' : '100 g';
    return {
      model: MODEL_VISION,
      system: PROMPTS.recognizeLabel + ` Werte beziehen sich auf ${basis}.`,
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: payload.imageBase64 } },
        { type: 'text', text: 'Lies die Nährwerte vom Etikett.' },
      ],
    };
  }
  return { model: MODEL_LIGHT, system: PROMPTS[fn], content: JSON.stringify(payload ?? {}) };
}

/** Mappt die Modellantwort auf das App-Schema (gleiche Shapes wie die App erwartet). */
function mapResult(fn, obj, payload) {
  if (fn === 'computeTargets') {
    return { kcal: num(obj.kcal), proteinG: num(obj.proteinG), carbsG: num(obj.carbsG), fatG: num(obj.fatG), fiberG: num(obj.fiberG), sugarG: num(obj.sugarG) };
  }
  if (fn === 'recognizeLabel') {
    const basis = payload?.basis === 'perPortion' ? 'perPortion' : 'per100g';
    return {
      name: String(obj.name ?? 'Produkt'),
      facts: { kcal: num(obj.kcal), proteinG: num(obj.proteinG), carbsG: num(obj.carbsG), fatG: num(obj.fatG), fiberG: num(obj.fiberG), sugarG: num(obj.sugarG), basis },
    };
  }
  if (fn === 'generateShoppingList') {
    const items = Array.isArray(obj.items) ? obj.items.map((i) => ({ name: String(i.name ?? ''), amount: num(i.amount), unit: String(i.unit ?? 'g'), checked: false, estPrice: num(i.estPrice) })) : [];
    return { items, suggestedDishes: Array.isArray(obj.suggestedDishes) ? obj.suggestedDishes.map(String) : [], estTotal: num(obj.estTotal), note: obj.note ? String(obj.note) : undefined };
  }
  if (fn === 'suggestFastfood') {
    const arr = Array.isArray(obj) ? obj : obj.items ?? [];
    return arr.map((i) => ({ restaurant: String(i.restaurant ?? payload?.restaurant ?? ''), itemName: String(i.itemName ?? ''), facts: { kcal: num(i.kcal), proteinG: num(i.proteinG), carbsG: num(i.carbsG), fatG: num(i.fatG), basis: 'perPortion' }, rationale: String(i.rationale ?? ''), estPrice: i.estPrice != null ? num(i.estPrice) : undefined }));
  }
  return obj;
}

async function handle(request, env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST erwartet' }), { status: 405, headers: corsHeaders(origin) });

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'Server ohne ANTHROPIC_API_KEY konfiguriert.' }), { status: 500, headers: corsHeaders(origin) });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON.' }), { status: 400, headers: corsHeaders(origin) });
  }

  const fn = body?.fn;
  if (!PROMPTS[fn]) return new Response(JSON.stringify({ error: `Unbekannte Funktion: ${fn}` }), { status: 400, headers: corsHeaders(origin) });

  const { model, system, content } = buildContent(fn, body.payload);
  const anthropicReq = { model, max_tokens: MAX_TOKENS[fn] || 800, system, messages: [{ role: 'user', content }] };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(anthropicReq),
  });
  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ error: 'Anthropic-Fehler', status: res.status, detail: detail.slice(0, 500) }), { status: 502, headers: corsHeaders(origin) });
  }

  const data = await res.json();
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
  try {
    const parsed = extractJson(text);
    return new Response(JSON.stringify(mapResult(fn, parsed, body.payload)), { headers: corsHeaders(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers: corsHeaders(origin) });
  }
}

// Cloudflare Workers / Vercel Edge
export default { fetch: handle };
