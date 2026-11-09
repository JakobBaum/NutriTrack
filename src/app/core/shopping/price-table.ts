import { ShoppingItem } from '../models';
import { DEFAULT_SHOPPING_CATEGORY, ShoppingCategory } from './shopping-category';

/**
 * Grobe Richtpreise je Supermarkt-Kategorie in EUR pro kg bzw. l (Österreich).
 * Nur Rückfall für Positionen, bei denen die KI keinen Preis geliefert hat;
 * ohne KI-Verbindung werden diese Werte nie angezeigt.
 */
export const CATEGORY_PRICE_PER_KG: Record<ShoppingCategory, number> = {
  'Obst & Gemüse': 3,
  'Kühlregal/Milchprodukte': 6,
  'Fleisch & Fisch': 14,
  'Brot & Backwaren': 6,
  'Trockenware/Nudeln/Reis': 3,
  'Konserven & Saucen': 4,
  'Gewürze & Öle': 12,
  'Tiefkühl': 6,
  'Getränke': 1.2,
  'Sonstiges': 5,
};

/** Gewicht einer Packungseinheit in g (grob), für Einheiten ohne Gewicht. */
const UNIT_WEIGHT_G: Record<string, number> = {
  stk: 150,
  stück: 150,
  dose: 400,
  pck: 250,
  bund: 100,
};

const PRICE_STEP = 0.1;

function isKnownCategory(category: string | undefined): category is ShoppingCategory {
  return category !== undefined && category in CATEGORY_PRICE_PER_KG;
}

/** Menge in kg (bzw. l) oder null, wenn die Einheit nicht umrechenbar ist (EL, Prise …). */
function toKg(amount: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'ml') return amount / 1000;
  if (u === 'kg' || u === 'l') return amount;
  const weight = UNIT_WEIGHT_G[u];
  return weight === undefined ? null : (amount * weight) / 1000;
}

/**
 * Richtpreis einer Position über die Kategorie-Tabelle, auf 10 Cent gerundet
 * (mindestens 0,10 €). Null bei fehlender/ungültiger Menge oder nicht umrechenbarer Einheit.
 */
export function estimateByCategory(item: ShoppingItem): number | null {
  if (!Number.isFinite(item.amount) || item.amount <= 0) return null;
  const kg = toKg(item.amount, item.unit);
  if (kg === null) return null;
  const perKg = CATEGORY_PRICE_PER_KG[isKnownCategory(item.category) ? item.category : DEFAULT_SHOPPING_CATEGORY];
  const rounded = Math.round((kg * perKg) / PRICE_STEP) * PRICE_STEP;
  return Math.round(Math.max(PRICE_STEP, rounded) * 100) / 100;
}

