/**
 * NutriTrack Cloudflare Worker
 * - GET  /off-search  → OpenFoodFacts Suche (CORS-Proxy)
 * - POST /            → KI-Proxy für Gemini (fn + payload)
 *
 * Secrets (über Wrangler setzen):
 *   wrangler secret put GEMINI_API_KEY
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── OpenFoodFacts Proxy ───────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/off-search') {
      const searchUrl = new URL('https://search.openfoodfacts.org/search');
      url.searchParams.forEach((v, k) => searchUrl.searchParams.set(k, v));
      const resp = await fetch(searchUrl.toString(), {
        headers: { 'User-Agent': 'NutriTrack/1.0' },
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── KI-Proxy (POST /) ─────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/') {
      if (!env.GEMINI_API_KEY) {
        return json({ error: 'GEMINI_API_KEY nicht konfiguriert.' }, 500);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Ungültiger JSON-Body.' }, 400);
      }

      const { fn, payload } = body;
      try {
        switch (fn) {
          case 'generateShoppingList':
            return json(await generateShoppingList(payload, env));
          case 'recognizeLabel':
            return json(await recognizeLabel(payload, env));
          case 'suggestFastfood':
            return json(await suggestFastfood(payload, env));
          case 'importRecipe':
            return json(await importRecipe(payload, env));
          case 'computeTargets':
            return json(await computeTargets(payload, env));
          default:
            return json({ error: `Unbekannte Funktion: ${fn}` }, 400);
        }
      } catch (e) {
        return json({ error: e.message ?? 'Interner Fehler.' }, 500);
      }
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};

// ── Hilfsfunktionen ────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function gemini(prompt, env, imageBase64 = null) {
  const parts = imageBase64
    ? [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: prompt },
      ]
    : [{ text: prompt }];

  let resp;
  try {
    resp = await fetch(
      `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      },
    );
  } catch (fetchErr) {
    throw new Error(`Gemini nicht erreichbar: ${fetchErr.message}`);
  }

  if (!resp.ok) {
    let errBody = '';
    try { errBody = await resp.text(); } catch { /* ignorieren */ }
    // Gemini gibt bei falschem Key 400 mit { error: { message: "..." } } zurück
    try {
      const parsed = JSON.parse(errBody);
      const msg = parsed?.error?.message ?? errBody;
      throw new Error(`Gemini ${resp.status}: ${msg}`);
    } catch (jsonErr) {
      if (jsonErr.message.startsWith('Gemini')) throw jsonErr;
      throw new Error(`Gemini ${resp.status}: ${errBody.slice(0, 200)}`);
    }
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini hat leere Antwort zurückgegeben.');

  // JSON aus dem Antworttext extrahieren (Gemini umschließt manchmal mit ```json)
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try { return JSON.parse(match[1] ?? match[0]); } catch { /* fällt durch */ }
  }
  try { return JSON.parse(text); } catch {
    throw new Error(`Gemini-Antwort kein JSON: ${text.slice(0, 200)}`);
  }
}

// ── KI-Funktionen ──────────────────────────────────────────────────────

async function generateShoppingList(req, env) {
  const recipeNames = (req.recipes ?? []).map(r => r.title).join(', ');
  const prompt = `Du bist ein Ernährungs-Assistent. Erstelle eine Einkaufsliste für ${req.persons} Person(en) für ${req.days} Tag(e).
Mahlzeiten: ${req.meals.join(', ')}.
${req.budget ? `Budget: ca. ${req.budget} €.` : ''}
${req.store ? `Markt: ${req.store}.` : ''}
${recipeNames ? `Vorhandene Rezepte als Basis: ${recipeNames}.` : ''}

Antworte NUR mit gültigem JSON (kein Markdown):
{
  "items": [{"name":"string","amount":number,"unit":"string","checked":false,"estPrice":number}],
  "suggestedDishes": ["string"],
  "estTotal": number,
  "note": "string oder null"
}`;
  return gemini(prompt, env);
}

async function recognizeLabel(req, env) {
  const prompt = `Lies die Nährwerttabelle auf diesem Lebensmitteletikett und gib die Werte ${req.basis === 'per100g' ? 'je 100 g' : 'je Portion'} zurück.
Antworte NUR mit gültigem JSON:
{
  "name": "Produktname",
  "facts": {
    "kcal": number,
    "proteinG": number,
    "carbsG": number,
    "fatG": number,
    "fiberG": number,
    "sugarG": number,
    "saltG": number,
    "basis": "${req.basis}",
    "portionG": number oder null
  }
}`;
  return gemini(prompt, env, req.imageBase64);
}

async function suggestFastfood(req, env) {
  const prompt = `Du bist ein Ernährungs-Coach. Schlage 3 Fastfood-Optionen vor.
Restaurant: ${req.restaurant || 'beliebig'}.
Kalorienbudget: ${req.kcalBudget} kcal.
${req.moneyBudget ? `Geldbudget: ${req.moneyBudget} €.` : ''}
Priorität: ${req.preference || 'proteinreich'}.

Antworte NUR mit gültigem JSON-Array:
[{
  "restaurant": "string",
  "itemName": "string",
  "facts": {"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"basis":"perPortion"},
  "rationale": "string",
  "estPrice": number
}]`;
  return gemini(prompt, env);
}

async function importRecipe(req, env) {
  let prompt;
  if (req.imageBase64) {
    prompt = `Extrahiere das Rezept aus diesem Foto. Gib Titel, Zutaten mit Mengen und Zubereitungsschritte zurück.`;
  } else if (req.url) {
    // Seite abrufen
    let pageText = '';
    try {
      const pageResp = await fetch(req.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 NutriTrack/1.0' },
        redirect: 'follow',
      });
      const html = await pageResp.text();
      // Groben Text extrahieren (HTML-Tags entfernen)
      pageText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000);
    } catch (e) {
      pageText = req.text ?? '';
    }
    prompt = `Extrahiere das Rezept aus folgendem Webseitentext:\n\n${pageText}\n\nQuelle: ${req.url}`;
  } else {
    prompt = `Extrahiere das Rezept aus folgendem Text:\n\n${req.text ?? ''}`;
  }

  prompt += `\n\nAntworte NUR mit gültigem JSON:
{
  "title": "string",
  "servings": number,
  "ingredients": [{"name":"string","amount":number,"unit":"string"}],
  "steps": ["string"],
  "sourceUrl": "string oder null"
}`;
  return gemini(prompt, env, req.imageBase64 ?? null);
}

async function computeTargets(profile, env) {
  const prompt = `Berechne den täglichen Kalorienbedarf und Makros für:
Gewicht: ${profile.weightKg} kg, Größe: ${profile.heightCm} cm, Alter: ${profile.age}, Geschlecht: ${profile.sex}.
Aktivität: ${profile.activityLevel}, Ziel: ${profile.goal}, Tempo: ${profile.rateKgPerWeek ?? 0.5} kg/Woche.
Verwende die Mifflin-St-Jeor-Formel.

Antworte NUR mit gültigem JSON:
{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number}`;
  return gemini(prompt, env);
}
