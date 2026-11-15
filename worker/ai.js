import { TOKENS_FASTFOOD, TOKENS_IMPORT, TOKENS_LABEL, TOKENS_LIST, TOKENS_QUERY, TOKENS_TRANSLATE, gemini } from './gemini.js';
import { ClientError, json, readBodyCapped } from './http.js';
import { AI_COUNTER, dailySlotResponse, isRateLimited, rateLimitedResponse, takeDailySlot } from './limits.js';
import { parseMeal } from './meal.js';
import { extractRecipeText, fetchPublicPage } from './page.js';
import { MAX_TR_QUERY_CHARS, TRANSLATE_LANGS, validateFastfoodRequest, validateImportRequest, validateLabelRequest, validateParseMealRequest, validateQueryTranslateRequest, validateShoppingRequest, validateTranslateRequest } from './validators.js';

const PHOTO_CALL_WEIGHT = 2;

// Foto-Obergrenze: die App skaliert auf ~1600 px; 4 Mio. Base64-Zeichen ≈ 3 MB Bild.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const AI_FUNCTIONS = {
  generateShoppingList: { validate: validateShoppingRequest, run: generateShoppingList },
  recognizeLabel: { validate: validateLabelRequest, run: recognizeLabel },
  suggestFastfood: { validate: validateFastfoodRequest, run: suggestFastfood },
  parseMeal: { validate: validateParseMealRequest, run: parseMeal },
  importRecipe: { validate: validateImportRequest, run: importRecipe },
  translateRecipe: { validate: validateTranslateRequest, run: translateRecipe },
  translateSearchQuery: { validate: validateQueryTranslateRequest, run: translateSearchQuery },
};

export async function aiProxy(request, env, cors) {
  const raw = await readBodyCapped(request, MAX_BODY_BYTES);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ClientError(400, 'Ungültiger JSON-Body.');
  }
  const handler = typeof body?.fn === 'string' && Object.hasOwn(AI_FUNCTIONS, body.fn) ? AI_FUNCTIONS[body.fn] : null;
  if (!handler) throw new ClientError(400, 'Unbekannte Funktion.');
  const rawPayload = body.payload ?? {};
  if (typeof rawPayload !== 'object' || Array.isArray(rawPayload)) throw new ClientError(400, 'Payload ungültig.');
  const payload = handler.validate(rawPayload);

  if (!env.GEMINI_API_KEY) throw new ClientError(503, 'KI ist auf dem Server nicht konfiguriert.');
  if (await isRateLimited(env.AI_LIMITER, request)) {
    return rateLimitedResponse('Zu viele KI-Anfragen — bitte kurz warten.', cors);
  }
  const blocked = dailySlotResponse(await takeDailySlot(env, dailyWeight(body.fn, payload), AI_COUNTER), AI_COUNTER, cors);
  if (blocked) return blocked;
  return json(await handler.run(payload, env), 200, cors);
}

/** Foto-Aufrufe (Vision) sind teurer und zählen doppelt gegen den Tagesdeckel. */
function dailyWeight(fn, payload) {
  return (fn === 'recognizeLabel' || fn === 'importRecipe') && payload.imageBase64 ? PHOTO_CALL_WEIGHT : 1;
}

async function generateShoppingList(req, env) {
  const prompt = `Du bist ein Ernährungs-Assistent. Erstelle eine Einkaufsliste für ${req.persons} Person(en) für ${req.days} Tag(e).
Mahlzeiten: ${req.meals.join(', ')}.
${req.budget ? `Budget: ca. ${req.budget} €.` : ''}
${req.store ? `Markt: ${req.store}.` : ''}
${req.recipeNames.length ? `Vorhandene Rezepte als Basis: ${req.recipeNames.join(', ')}.` : ''}

Antworte NUR mit gültigem JSON (kein Markdown):
{
  "items": [{"name":"string","amount":number,"unit":"string","checked":false,"estPrice":number}],
  "suggestedDishes": ["string"],
  "estTotal": number,
  "note": "string oder null"
}`;
  return gemini(prompt, env, null, { maxOutputTokens: TOKENS_LIST });
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
  return gemini(prompt, env, req.imageBase64, { maxOutputTokens: TOKENS_LABEL });
}

/** Kriterien als Text: neue Liste, sonst das alte Einzelfeld, sonst proteinreich. */
function fastfoodCriteria(req) {
  if (req.preferences.length > 0) return req.preferences.join('; ');
  return req.preference || 'proteinreich';
}

async function suggestFastfood(req, env) {
  const exclude = req.exclude.length > 0 ? `Diese Produkte wurden schon vorgeschlagen und dürfen NICHT erneut vorkommen: ${req.exclude.join('; ')}.` : '';
  const prompt = `Du bist ein Ernährungs-Coach. Schlage 3 Fastfood-Optionen vor.
Restaurant: ${req.restaurant || 'beliebig'}.
Land: ${req.country}. Nenne nur Produkte, die es in ${req.country} bei diesem Restaurant gibt; Preise in der Landeswährung als EUR-Schätzung.
Kalorienbudget: ${req.kcalBudget} kcal.
${req.moneyBudget ? `Geldbudget: ${req.moneyBudget} €.` : ''}
Kriterien (alle gleichzeitig berücksichtigen): ${fastfoodCriteria(req)}.
${exclude}

Antworte NUR mit gültigem JSON-Array:
[{
  "restaurant": "string",
  "itemName": "string",
  "facts": {"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"basis":"perPortion"},
  "rationale": "string",
  "estPrice": number
}]`;
  return gemini(prompt, env, null, { maxOutputTokens: TOKENS_FASTFOOD });
}

const IMPORT_SCHEMA = `Antworte NUR mit gültigem JSON:
{
  "title": "string",
  "servings": number,
  "ingredients": [{"name":"string","amount":number,"unit":"string",
    "facts":{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number,
             "basis":"per100g"|"perPortion","portionG":number}}],
  "steps": ["string"]
}
Mengen als Zahl, Einheit getrennt (z.B. "g","ml","EL","Stk"). servings als Ganzzahl (Standard 2).
Nährwerte je Zutat: bei g/ml je 100 g (basis "per100g"), bei Stück/Löffel/Zehe für EINE Einheit
(basis "perPortion", portionG = ungefähres Gewicht einer Einheit in g). Unbekannte Zutat → "facts" weglassen.
Zutaten und Schritte auf Deutsch.`;

async function importRecipe(req, env) {
  let prompt;
  if (req.imageBase64) {
    prompt = 'Extrahiere das Rezept aus diesem Foto.';
  } else if (req.url) {
    const page = await fetchPublicPage(req.url).catch((e) => {
      if (req.text) return req.text;
      throw e;
    });
    prompt = `Extrahiere das Rezept aus folgendem Seiteninhalt (Quelle: ${req.url}):\n\n${extractRecipeText(page)}`;
  } else {
    prompt = `Extrahiere das Rezept aus folgendem Text:\n\n${req.text}`;
  }
  return gemini(`${prompt}\n\n${IMPORT_SCHEMA}`, env, req.imageBase64 ?? null, { maxOutputTokens: TOKENS_IMPORT });
}

const TRANSLATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'ingredients', 'steps'],
};

const QUERY_SCHEMA = {
  type: 'OBJECT',
  properties: { query: { type: 'STRING' } },
  required: ['query'],
};

/** Gleich viele Einträge wie die Eingabe; leere oder fehlende Übersetzungen fallen auf das Original zurück. */
function alignList(translated, source) {
  if (!Array.isArray(translated) || translated.length !== source.length) return [...source];
  return source.map((orig, i) => {
    const t = typeof translated[i] === 'string' ? translated[i].trim() : '';
    return t || orig;
  });
}

async function translateRecipe(req, env) {
  const language = TRANSLATE_LANGS[req.lang];
  const prompt = `Übersetze dieses englische Rezept ins ${language}.
Regeln:
- "title": übersetzter Titel.
- "ingredients": gleiche Anzahl und Reihenfolge wie die Eingabe. Jeder Eintrag ist ein Zutatenname in der Einkaufs-Grundform:
  ohne Mengen, Zubereitungswörter und Marken, Einzahl wo üblich (z. B. "pork shoulder" -> "Schweineschulter",
  "chopped fresh rosemary" -> "Rosmarin, frisch", "2 cloves garlic, minced" -> "Knoblauch").
- "steps": gleiche Anzahl und Reihenfolge, natürliches ${language}, Zahlen, Temperaturen und Zeiten unverändert lassen.
Antworte NUR mit gültigem JSON.

Titel: ${req.title}
Zutaten:
${req.ingredients.map((n, i) => `${i + 1}. ${n}`).join('\n')}
Schritte:
${req.steps.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  const out = await gemini(prompt, env, null, {
    maxOutputTokens: TOKENS_TRANSLATE,
    temperature: 0,
    responseSchema: TRANSLATE_SCHEMA,
  });
  return {
    title: typeof out?.title === 'string' && out.title.trim() ? out.title.trim() : req.title,
    ingredients: alignList(out?.ingredients, req.ingredients),
    steps: alignList(out?.steps, req.steps),
  };
}

async function translateSearchQuery(req, env) {
  const prompt = `Übersetze diesen Suchbegriff für eine Rezeptdatenbank (${TRANSLATE_LANGS[req.lang]}) ins Englische. Nur die Übersetzung, keine Erklärung. Ist er schon Englisch, gib ihn unverändert zurück.
Suchbegriff: ${req.query}`;
  const out = await gemini(prompt, env, null, {
    maxOutputTokens: TOKENS_QUERY,
    temperature: 0,
    responseSchema: QUERY_SCHEMA,
  });
  const query = typeof out?.query === 'string' ? out.query.trim().slice(0, MAX_TR_QUERY_CHARS) : '';
  return { query: query || req.query };
}
