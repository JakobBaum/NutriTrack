import { ShoppingItem } from '../models';
import { nameKey } from './ingredient-name';
import { DEFAULT_SPICE_PRICE, PRICE_TABLE, PriceEntry } from './ingredient-price-table';
import { CATEGORY_PRICE_PER_KG } from './price-table';
import { DEFAULT_SHOPPING_CATEGORY, ShoppingCategory, categorizeName } from './shopping-category';
import { normalizeUnit } from './shopping-units';
import { spiceUnitFor } from './spice-rules';

const PRICE_ROUND_STEP = 0.05;
const MIN_PRICE = 0.29;
const LOOSE_STEP_G = 100;
const UNKNOWN_STEP_G = 250;
const UNKNOWN_PIECE_G = 150;
const CLOVES_PER_BULB = 10;
const GRAMS_BY_COUNT_UNIT: Readonly<Record<string, number>> = { dose: 400, pck: 250, bund: 100, topf: 50, prise: 1, scheibe: 25 };

function wordMatches(word: string, key: string): boolean {
  if (key === 'öl') return word.endsWith('öl');
  return word === key || (key.length >= 5 && word.includes(key));
}

/** Länge des besten passenden Suchworts eines Eintrags (0 = kein Treffer). */
function matchScore(entry: PriceEntry, full: string, words: readonly string[]): number {
  return entry.keys.reduce((best, key) => {
    const hit = key.includes(' ') ? full.includes(key) : words.some((w) => wordMatches(w, key));
    return hit ? Math.max(best, key.length) : best;
  }, 0);
}

/** Passender Preiseintrag (längstes Suchwort gewinnt) oder undefined. */
export function findPriceEntry(name: string): PriceEntry | undefined {
  const full = nameKey(name);
  const words = full.split(/[\s,]+/).filter(Boolean);
  let best: PriceEntry | undefined;
  let bestScore = 0;
  for (const entry of PRICE_TABLE) {
    const score = matchScore(entry, full, words);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function roundPrice(value: number): number {
  if (value === 0) return 0;
  const stepped = Math.round(value / PRICE_ROUND_STEP) * PRICE_ROUND_STEP;
  return Math.round(Math.max(MIN_PRICE, stepped) * 100) / 100;
}

interface Need {
  /** Bedarf in Gramm bzw. ml (Näherung). */
  grams: number;
  /** Bedarf als Zählwert (Stück, Packung, Bund ...). */
  count: number;
  isCount: boolean;
}

function need(item: ShoppingItem, entry: PriceEntry | undefined): Need {
  const norm = normalizeUnit(item.amount > 0 ? item.amount : 0, item.unit);
  const unit = norm.unit.toLowerCase();
  const pieceG = entry?.pieceG ?? UNKNOWN_PIECE_G;
  if (unit === 'g' || unit === 'ml') return { grams: norm.amount, count: 1, isCount: false };
  if (unit === 'stk') return { grams: norm.amount * pieceG, count: norm.amount, isCount: true };
  if (unit === 'zehe') return { grams: norm.amount * 5, count: Math.ceil(norm.amount / CLOVES_PER_BULB), isCount: true };
  const unitG = unit === 'pck' && entry?.packG ? entry.packG : GRAMS_BY_COUNT_UNIT[unit];
  if (unitG !== undefined) return { grams: norm.amount * unitG, count: norm.amount, isCount: true };
  return { grams: norm.amount > 0 ? norm.amount : 0, count: 1, isCount: false };
}

function ceilTo(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step - 1e-9) * step);
}

function pricePerKgEntry(entry: PriceEntry, n: Need): number {
  const grams = n.grams > 0 ? n.grams : entry.packG ?? LOOSE_STEP_G;
  const bought = entry.packG ? ceilTo(grams, entry.packG) : ceilTo(grams, LOOSE_STEP_G);
  return (bought / 1000) * entry.price;
}

function priceByEntry(entry: PriceEntry, item: ShoppingItem): number {
  const n = need(item, entry);
  if (entry.basis === 'pack') return entry.price * Math.max(1, Math.ceil(n.isCount ? n.count - 1e-9 : 1));
  if (entry.basis === 'pc') {
    const pieces = n.isCount ? n.count : n.grams / (entry.pieceG ?? 100);
    return entry.price * Math.max(1, Math.ceil(pieces - 1e-9));
  }
  return pricePerKgEntry(entry, n);
}

function categoryOf(item: ShoppingItem): ShoppingCategory {
  const c = item.category;
  return c && c in CATEGORY_PRICE_PER_KG ? (c as ShoppingCategory) : categorizeName(item.name) ?? DEFAULT_SHOPPING_CATEGORY;
}

function priceByCategory(item: ShoppingItem): number {
  const n = need(item, undefined);
  const grams = ceilTo(Math.max(n.grams, 1), UNKNOWN_STEP_G);
  return (grams / 1000) * CATEGORY_PRICE_PER_KG[categoryOf(item)];
}

/**
 * Geschätzter Kaufpreis einer Position in EUR, deterministisch: Tabelle der häufigsten Zutaten, gerechnet auf die
 * Packungsgröße, die man tatsächlich kauft (1/2 Zwiebel kostet das 1-kg-Netz). Gewürze kosten eine Packung.
 * Unbekannte Zutaten: Durchschnittspreis der Kategorie. Auf 5 Cent gerundet.
 */
export function estimateItemPrice(item: ShoppingItem): number {
  const entry = findPriceEntry(item.name);
  if (entry) return roundPrice(priceByEntry(entry, item));
  if (spiceUnitFor(item.name)) return roundPrice(DEFAULT_SPICE_PRICE);
  return roundPrice(priceByCategory(item));
}

/** Ergänzt fehlende Schätzpreise über die Zutaten-Tabelle (Rückfall Kategorie); vorhandene Preise bleiben. */
export function fillMissingPrices(items: readonly ShoppingItem[]): ShoppingItem[] {
  return items.map((it) => (it.estPrice != null ? it : { ...it, estPrice: estimateItemPrice(it) }));
}
