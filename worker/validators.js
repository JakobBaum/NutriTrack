import { ClientError } from './http.js';
import { isPublicHttpUrl } from './ssrf.js';

const MAX_IMAGE_CHARS = 4 * 1024 * 1024;

const MAX_TEXT_CHARS = 20000;

function num(value, min, max, name) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw new ClientError(400, `${name} ungültig.`);
  }
  return n;
}

function optNum(value, min, max, name) {
  return value === undefined || value === null || value === '' ? undefined : num(value, min, max, name);
}

/** Kürzt und entschärft Freitext für Prompts (keine Steuerzeichen). */
export function text(value, maxChars) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, maxChars);
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new ClientError(400, `${name} ungültig.`);
  return value;
}

export function image(value) {
  if (typeof value !== 'string' || value.length === 0) throw new ClientError(400, 'Foto fehlt.');
  if (value.length > MAX_IMAGE_CHARS) throw new ClientError(413, 'Foto zu groß.');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) throw new ClientError(400, 'Foto ist kein Base64.');
  return value;
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export function validateShoppingRequest(p) {
  const meals = Array.isArray(p.meals) ? p.meals.filter((m) => MEALS.includes(m)) : [];
  if (meals.length === 0) throw new ClientError(400, 'Mahlzeiten fehlen.');
  return {
    persons: num(p.persons, 1, 20, 'Personen'),
    days: num(p.days, 1, 14, 'Tage'),
    meals,
    budget: optNum(p.budget, 0, 5000, 'Budget'),
    store: text(p.store, 40),
    recipeNames: (Array.isArray(p.recipes) ? p.recipes : []).slice(0, 30).map((r) => text(r?.title, 80)).filter(Boolean),
  };
}

export function validateLabelRequest(p) {
  return { imageBase64: image(p.imageBase64), basis: oneOf(p.basis ?? 'per100g', ['per100g', 'perPortion'], 'Basis') };
}

// Fastfood-Helfer: Obergrenzen und feste Länderliste (Sortiment gilt je Land).
const FASTFOOD_MAX_PREFERENCES = 4;

const FASTFOOD_PREFERENCE_CHARS = 30;

const FASTFOOD_MAX_EXCLUDE = 20;

const FASTFOOD_EXCLUDE_CHARS = 60;

const FASTFOOD_COUNTRIES = [
  'Österreich', 'Deutschland', 'Schweiz', 'Italien', 'Spanien', 'Frankreich', 'Niederlande', 'Vereinigtes Königreich', 'USA',
];

const FASTFOOD_DEFAULT_COUNTRY = FASTFOOD_COUNTRIES[0];

/** Einzeiliger Freitext für Prompts: alle Steuerzeichen (auch Zeilenumbrüche) werden zu Leerzeichen. */
function lineText(value, maxChars) {
  return text(String(value ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' '), maxChars);
}

/** Liste aus Kurztexten: fehlt sie, ist sie leer; kein Array ist ein Fehler; leere Einträge entfallen. */
function lineList(value, maxItems, maxChars, name) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ClientError(400, `${name} ungültig.`);
  return value.slice(0, maxItems).map((v) => lineText(v, maxChars)).filter(Boolean);
}

export function validateFastfoodRequest(p) {
  return {
    restaurant: lineText(p.restaurant, 60),
    kcalBudget: num(p.kcalBudget, 50, 5000, 'Kalorienbudget'),
    moneyBudget: optNum(p.moneyBudget, 0, 200, 'Geldbudget'),
    preference: lineText(p.preference, 60),
    preferences: lineList(p.preferences, FASTFOOD_MAX_PREFERENCES, FASTFOOD_PREFERENCE_CHARS, 'Kriterien'),
    country: FASTFOOD_COUNTRIES.includes(p.country) ? p.country : FASTFOOD_DEFAULT_COUNTRY,
    // Die jüngsten Namen zählen: die App hängt neue Runden hinten an.
    exclude: lineList(Array.isArray(p.exclude) ? p.exclude.slice(-FASTFOOD_MAX_EXCLUDE) : p.exclude, FASTFOOD_MAX_EXCLUDE, FASTFOOD_EXCLUDE_CHARS, 'Ausschlussliste'),
  };
}

export function validateImportRequest(p) {
  if (p.imageBase64) return { imageBase64: image(p.imageBase64) };
  if (p.url) {
    const url = text(p.url, 2048);
    if (!isPublicHttpUrl(url)) throw new ClientError(400, 'Diese URL kann nicht importiert werden.');
    return { url, text: text(p.text, MAX_TEXT_CHARS) };
  }
  const recipeText = text(p.text, MAX_TEXT_CHARS);
  if (!recipeText) throw new ClientError(400, 'Rezept-Text, Link oder Foto fehlt.');
  return { text: recipeText };
}

// Übersetzung: Zielsprachen (erweiterbar) und Obergrenzen je Rezept.
export const TRANSLATE_LANGS = { de: 'Deutsch' };

const MAX_TR_INGREDIENTS = 60;

const MAX_TR_STEPS = 40;

const MAX_TR_TITLE = 200;

const MAX_TR_INGREDIENT_CHARS = 120;

const MAX_TR_STEP_CHARS = 1200;

export const MAX_TR_QUERY_CHARS = 120;

function textList(value, maxItems, maxChars, name) {
  if (!Array.isArray(value)) throw new ClientError(400, `${name} ungültig.`);
  if (value.length > maxItems) throw new ClientError(400, `${name}: zu viele Einträge.`);
  return value.map((v) => text(v, maxChars));
}

export function validateTranslateRequest(p) {
  const title = text(p.title, MAX_TR_TITLE);
  if (!title) throw new ClientError(400, 'Titel fehlt.');
  return {
    lang: oneOf(p.lang ?? 'de', Object.keys(TRANSLATE_LANGS), 'Sprache'),
    title,
    ingredients: textList(p.ingredients, MAX_TR_INGREDIENTS, MAX_TR_INGREDIENT_CHARS, 'Zutaten'),
    steps: textList(p.steps, MAX_TR_STEPS, MAX_TR_STEP_CHARS, 'Schritte'),
  };
}

export function validateQueryTranslateRequest(p) {
  const query = text(p.query, MAX_TR_QUERY_CHARS);
  if (!query) throw new ClientError(400, 'Suchbegriff fehlt.');
  return { lang: oneOf(p.lang ?? 'de', Object.keys(TRANSLATE_LANGS), 'Sprache'), query };
}

// Essen per Text (parseMeal): Beschreibung 1 bis 500 Zeichen.
export const MAX_MEAL_TEXT_CHARS = 500;

/** Der Nutzertext ist Daten: Steuerzeichen und das Abgrenzungs-Tag des Prompts werden entfernt. */
export function validateParseMealRequest(p) {
  if (typeof p.text !== 'string') throw new ClientError(400, 'Text fehlt.');
  const cleaned = text(p.text.replace(/<\/?nutzertext[^>]*>/gi, ' ').replace(/[<>]/g, ' '), Number.MAX_SAFE_INTEGER);
  if (!cleaned) throw new ClientError(400, 'Text fehlt.');
  if (cleaned.length > MAX_MEAL_TEXT_CHARS) throw new ClientError(400, `Text zu lang (höchstens ${MAX_MEAL_TEXT_CHARS} Zeichen).`);
  return { text: cleaned };
}
