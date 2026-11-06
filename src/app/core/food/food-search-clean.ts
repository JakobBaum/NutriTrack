import { FoodItem } from '../models';

/** Reine Hilfsfunktionen zum Aufräumen und Ranken von Produktsuch-Treffern. */

const MAX_BRANDS = 1;
const SEP_CLASS = '[\\s,;:\\-–—/·|(]';
const UNIT = '(?:kg|g|mg|ml|cl|dl|l|stk|stück)';
const NUM = '\\d+(?:[.,]\\d+)?';
const MULTI_RE = new RegExp(`\\b(\\d+)\\s?[x×]\\s?(${NUM})\\s?(${UNIT})(?![a-zäöü])`, 'i');
const SIZE_RE = new RegExp(`\\b(${NUM})\\s?(${UNIT})(?![a-zäöü])`, 'i');
const COUNT_TOKEN_RE = /\b(?:x\s?\d+|\d+\s?x)(?![a-zäöü\d])/gi;
const PACKAGING_RE = /\b(?:mehrweg|einweg|pet|pfand|dose|flasche|glas)\b/gi;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

const PROCESSED_NAME_RE =
  /chips|crisps|getrocknet|dörr|trockenfrucht|gelee|sirup|marmelade|konfitüre|bonbon|fruchtgummi|riegel|schokolade|keks|kuchen|smoothie|saft|nektar|pulver|snack|aroma/i;
const PROCESSED_CATEGORY_RE = /snack|chips|dried|jam|syrup|confection|biscuit|dessert|juice|sweet/i;
const MIN_GENERIC_QUERY_LENGTH = 3;

const TIER_NAME_PREFIX = 3;
const TIER_NAME = 2;
const TIER_BRAND = 1;
const TIER_NONE = 0;

/** Kleinbuchstaben, ohne Diakritika/Sonderzeichen: Vergleichsschlüssel. */
export function foldKey(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function words(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function titleCase(s: string): string {
  return s.replace(/(^|\s)(\S)/g, (_m, sp: string, c: string) => sp + c.toUpperCase());
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimSeparators(s: string): string {
  return s
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:\-–—/·|)]+|[\s,;:\-–—/·|(]+$/g, '')
    .trim();
}

/** "Milka Milka" -> "Milka" (Wort-Folge besteht aus zwei identischen Hälften). */
function collapseRepeat(s: string): string {
  const parts = s.split(/\s+/);
  if (parts.length < 2 || parts.length % 2 !== 0) return s;
  const half = parts.length / 2;
  const a = parts.slice(0, half).join(' ');
  const b = parts.slice(half).join(' ');
  return a.toLowerCase() === b.toLowerCase() ? a : s;
}

function cleanBrandToken(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const deslugged = SLUG_RE.test(t) ? titleCase(t.replace(/-/g, ' ')) : t;
  return collapseRepeat(deslugged);
}

/**
 * Markenliste säubern: an Kommas trennen, trimmen, Slugs ("k-take-it-veggie")
 * in Titel-Schreibweise, Dubletten (case-/zeichen-unabhängig) und Wiederholungen
 * entfernen. Leer, wenn die Marke dem Produktnamen entspricht.
 */
export function normalizeBrand(
  raw: string | readonly string[] | undefined,
  name?: string,
): string | undefined {
  const tokens: string[] = typeof raw === 'string' ? [raw] : [...(raw ?? [])];
  const seen = new Set<string>();
  const brands: string[] = [];
  for (const t of tokens.flatMap((x) => x.split(','))) {
    const cleaned = cleanBrandToken(t);
    const key = foldKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    brands.push(cleaned);
  }
  const nameKey = foldKey(name);
  const visible = brands.filter((b) => foldKey(b) !== nameKey).slice(0, MAX_BRANDS);
  return visible.length ? visible.join(', ') : undefined;
}

/** "400g" -> "400 g", "1L" -> "1 l", "6x250ml" -> "6 × 250 ml". */
export function normalizeQuantity(raw: string | undefined): string | undefined {
  const t = (raw ?? '').trim();
  if (!t) return undefined;
  const multi = MULTI_RE.exec(t);
  if (multi) return `${multi[1]} × ${multi[2]} ${multi[3].toLowerCase()}`;
  const size = SIZE_RE.exec(t);
  if (size) return `${size[1]} ${size[2].toLowerCase()}`;
  return t;
}

export interface StrippedName {
  readonly name: string;
  readonly quantity?: string;
}

/**
 * Packungsgrößen aus dem Namen entfernen ("Banane 120g", "Wasser 1L X1",
 * "Mehrweg Pet 1L") und als Menge zurückgeben. Ohne Größen-Token bleibt der Name
 * unverändert; wäre er danach leer, bleibt der Originalname.
 */
export function stripSize(rawName: string): StrippedName {
  const original = (rawName ?? '').trim();
  const match = MULTI_RE.exec(original) ?? SIZE_RE.exec(original);
  if (!match) return { name: original };
  const quantity = normalizeQuantity(match[0]);
  const stripped = trimSeparators(
    original
      .replace(match[0], ' ')
      .replace(COUNT_TOKEN_RE, ' ')
      .replace(PACKAGING_RE, ' '),
  );
  return { name: stripped || original, quantity };
}

/** Marke(n) aus dem Namen entfernen ("Haferflocken Crownfield" -> "Haferflocken"). */
export function removeBrandFromName(name: string, brand: string | undefined): string {
  if (!brand) return name;
  let result = name;
  for (const b of brand.split(',').map((x) => x.trim()).filter(Boolean)) {
    const re = new RegExp(`(^|${SEP_CLASS})${escapeRe(b)}(?=$|[\\s,;:\\-–—/·|)])`, 'i');
    const next = trimSeparators(result.replace(re, ' '));
    if (/[a-zäöüß]/i.test(next)) result = next;
  }
  return result;
}

/** Eintrag der Suche samt Ranking-Metadaten. */
export interface RankEntry {
  readonly item: FoodItem;
  /** Sprach-/Länder-Score (nur Gleichstand-Kriterium). */
  readonly locale: number;
  readonly categories?: readonly string[];
}

/** Entfernt Duplikate (gleicher Name + Marke + gerundete kcal); erster Treffer gewinnt. */
export function dedupe<T extends FoodItem>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = `${foldKey(it.name)}|${foldKey(it.brand)}|${Math.round(it.facts.kcal)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchTier(entry: RankEntry, tokens: readonly string[]): number {
  if (!tokens.length) return TIER_NONE;
  const nameWords = words(entry.item.name);
  const nameJoined = nameWords.join(' ');
  const inName = (t: string) => nameJoined.includes(t);
  if (tokens.every(inName)) {
    return nameWords[0]?.startsWith(tokens[0]) ? TIER_NAME_PREFIX : TIER_NAME;
  }
  const brandJoined = words(entry.item.brand ?? '').join(' ');
  const inEither = (t: string) => inName(t) || brandJoined.includes(t);
  const anyBrand = tokens.some((t) => brandJoined.includes(t));
  return anyBrand && tokens.every(inEither) ? TIER_BRAND : TIER_NONE;
}

function isProcessed(entry: RankEntry, tokens: readonly string[]): boolean {
  const name = entry.item.name;
  const byName = PROCESSED_NAME_RE.test(name) && !tokens.some((t) => PROCESSED_NAME_RE.test(t));
  const byCategory = (entry.categories ?? []).some((c) => PROCESSED_CATEGORY_RE.test(c));
  return byName || byCategory;
}

/**
 * Relevanz-Ranking: Name-Treffer vor reinen Marken-Treffern vor Rest; bei
 * Ein-Wort-Suchen (z.B. "banane") verarbeitete Varianten nach hinten; erst
 * danach der Locale-Score als Tie-Break, zuletzt die Originalreihenfolge.
 */
export function rank(entries: readonly RankEntry[], query: string): RankEntry[] {
  const tokens = words(query);
  const generic = tokens.length === 1 && tokens[0].length >= MIN_GENERIC_QUERY_LENGTH;
  return entries
    .map((e, i) => ({
      e,
      i,
      tier: matchTier(e, tokens),
      processed: generic && isProcessed(e, tokens) ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.tier - a.tier ||
        a.processed - b.processed ||
        b.e.locale - a.e.locale ||
        a.i - b.i,
    )
    .map(({ e }) => e);
}
