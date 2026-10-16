/**
 * NutriTrack KI-Proxy (serverless, host-agnostischer `fetch`-Handler).
 *
 * Zweck: EIN interner Gemini-API-Key für ALLE App-Nutzer. Der Key liegt
 * ausschließlich serverseitig in der Umgebungsvariable `GEMINI_API_KEY` —
 * niemals im Client. Die App ruft nur diesen Proxy, die System-Prompts sind
 * hier fix hinterlegt und pro Funktion gewählt.
 *
 * Deploy: Cloudflare Workers (`wrangler deploy`), Vercel Edge oder Node.
 * Siehe README.md. CORS ist offen (öffentliche App) — bei Bedarf ALLOWED_ORIGIN
 * in der Umgebung setzen, um auf die eigene Domain zu beschränken.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Ein Modell für alles — Gemini 3.8 Flash ist multimodal (Text + Vision).
const MODEL = 'gemini-3.8-flash';

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
  importRecipe:
    'Du extrahierst Rezepte in strukturiertes JSON. Antworte NUR mit JSON: ' +
    '{"title":string,"servings":number,"ingredients":[{"name":string,"amount":number,"unit":string}],' +
    '"steps":[string]}. ' +
    'Mengen als Zahl, Einheit getrennt (z.B. "g","ml","EL","Stk"). servings als Ganzzahl (Standard 2). ' +
    'Schreibe Zutaten und Schritte auf Deutsch. Keine Erklärung.',
};

const MAX_TOKENS = {
  computeTargets: 400,
  generateShoppingList: 1500,
  recognizeLabel: 500,
  suggestFastfood: 800,
  importRecipe: 1500,
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

/** Holt eine URL serverseitig und reduziert HTML grob auf Text (löst Browser-CORS). */
async function fetchUrlText(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'NutriTrack/1.0' } });
    if (!res.ok) return '';
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  } catch {
    return '';
  }
}

/** Baut System-Prompt + Gemini-`parts` je Funktion (Text oder Vision). */
async function buildContent(fn, payload) {
  if (fn === 'recognizeLabel') {
    const basis = payload?.basis === 'perPortion' ? 'eine Portion' : '100 g';
    return {
      system: PROMPTS.recognizeLabel + ` Werte beziehen sich auf ${basis}.`,
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: payload.imageBase64 } },
        { text: 'Lies die Nährwerte vom Etikett.' },
      ],
    };
  }
  if (fn === 'importRecipe') {
    const text = (payload?.text || '').trim();
    const source = text || (payload?.url ? await fetchUrlText(payload.url) : '');
    return { system: PROMPTS.importRecipe, parts: [{ text: `Rezept-Quelle:\n${source}` }] };
  }
  return { system: PROMPTS[fn], parts: [{ text: JSON.stringify(payload ?? {}) }] };
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
  if (fn === 'importRecipe') {
    const ingredients = Array.isArray(obj.ingredients)
      ? obj.ingredients.map((i) => ({ name: String(i.name ?? '').trim(), amount: num(i.amount), unit: String(i.unit ?? 'g').trim() || 'g' })).filter((i) => i.name)
      : [];
    return {
      title: String(obj.title ?? 'Importiertes Rezept').trim() || 'Importiertes Rezept',
      servings: Math.max(1, Math.round(num(obj.servings) || 2)),
      ingredients,
      steps: Array.isArray(obj.steps) ? obj.steps.map(String) : [],
      sourceUrl: payload?.url,
    };
  }
  return obj;
}

async function handle(request, env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST erwartet' }), { status: 405, headers: corsHeaders(origin) });

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'Server ohne GEMINI_API_KEY konfiguriert.' }), { status: 500, headers: corsHeaders(origin) });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON.' }), { status: 400, headers: corsHeaders(origin) });
  }

  const fn = body?.fn;
  if (!PROMPTS[fn]) return new Response(JSON.stringify({ error: `Unbekannte Funktion: ${fn}` }), { status: 400, headers: corsHeaders(origin) });

  const { system, parts } = await buildContent(fn, body.payload);
  const geminiReq = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: MAX_TOKENS[fn] || 800, responseMimeType: 'application/json', temperature: 0 },
  };

  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(geminiReq),
  });
  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ error: 'Gemini-Fehler', status: res.status, detail: detail.slice(0, 500) }), { status: 502, headers: corsHeaders(origin) });
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('\n');
  try {
    const parsed = extractJson(text);
    return new Response(JSON.stringify(mapResult(fn, parsed, body.payload)), { headers: corsHeaders(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers: corsHeaders(origin) });
  }
}

// Cloudflare Workers / Vercel Edge
export default { fetch: handle };
