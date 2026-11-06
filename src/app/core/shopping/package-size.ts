import { ShoppingItem } from '../models';
import { ONION_PIECE_G, UNIT_WEIGHT_G } from '../nutrition/units-weight';

/** Eine Rundungsregel auf einkaufbare Packungsgrößen. */
interface PackRule {
  /** Teilwörter im kleingeschriebenen Namen. */
  keywords: readonly string[];
  /** Namen, die trotz Treffer ausgenommen sind (z. B. Kokosmilch bei „milch“). */
  exclude?: readonly string[];
  kind: 'pack' | 'liter' | 'piece';
  /** pack: gängige Packungsgrößen in g/ml (aufsteigend). */
  packs?: readonly number[];
  /** piece: Gramm pro Stück, um g-Mengen in Stück umzurechnen. */
  gramsPerPiece?: number;
}

const RULES: readonly PackRule[] = [
  { keywords: ['nudel', 'pasta', 'spaghetti', 'penne', 'fusilli', 'tagliatelle', 'makkaroni'], kind: 'pack', packs: [500] },
  { keywords: ['passierte', 'passata', 'gehackte tomaten'], kind: 'pack', packs: [500, 700] },
  { keywords: ['reis'], kind: 'pack', packs: [500] },
  { keywords: ['mehl', 'zucker'], kind: 'pack', packs: [1000] },
  { keywords: ['zwiebel'], kind: 'piece', gramsPerPiece: ONION_PIECE_G },
  { keywords: ['milch'], exclude: ['kokos', 'schoko'], kind: 'liter' },
];

/** Zählbare Einheiten, die nie als Bruchteil gekauft werden. */
const COUNT_UNITS = new Set(['stk', 'stück', 'zehe', 'bund', 'dose', 'pck']);

/** Kleinste Packungsgröße >= Menge; darüber Vielfache der kleinsten Packung. */
export function ceilToPack(amount: number, packs: readonly number[]): number {
  const fit = packs.find((p) => p >= amount);
  if (fit !== undefined) return fit;
  return Math.ceil(amount / packs[0]) * packs[0];
}

/** Menge, Einheit und Verhältnis neu/alt (für den Preis) einer gerundeten Position. */
interface Rounded {
  amount: number;
  unit: string;
  factor: number;
}

function roundByRule(rule: PackRule, amount: number, unit: string): Rounded | null {
  if (rule.kind === 'pack' && (unit === 'g' || unit === 'ml')) {
    const next = ceilToPack(amount, rule.packs ?? [500]);
    return { amount: next, unit, factor: next / amount };
  }
  if (rule.kind === 'liter' && (unit === 'ml' || unit === 'l')) {
    const liters = unit === 'ml' ? amount / 1000 : amount;
    const next = Math.ceil(liters - 1e-9);
    return { amount: next, unit: 'l', factor: next / liters };
  }
  if (rule.kind === 'piece' && unit === 'g') {
    const pieces = Math.ceil(amount / (rule.gramsPerPiece ?? UNIT_WEIGHT_G['Stk']) - 1e-9);
    return { amount: pieces, unit: 'Stk', factor: (pieces * (rule.gramsPerPiece ?? UNIT_WEIGHT_G['Stk'])) / amount };
  }
  return null;
}

function roundCountUnit(amount: number, unit: string): Rounded | null {
  if (!COUNT_UNITS.has(unit)) return null;
  const next = Math.ceil(amount - 1e-9);
  return next === amount ? null : { amount: next, unit: unit === 'stück' ? 'Stück' : unit, factor: next / amount };
}

/**
 * Rundet die Menge auf eine einkaufbare Packung auf (Nudeln 500 g, Passata 500/700 g,
 * Zwiebeln und andere Zählware ganze Stück, Milch ganze Liter). Ein vorhandener
 * Schätzpreis wird im Verhältnis der Mengen mitgeführt. Neue Position, Eingabe bleibt unverändert.
 */
export function roundToPackage(item: ShoppingItem): ShoppingItem {
  if (!(item.amount > 0) || !Number.isFinite(item.amount)) return item;
  const unit = item.unit.trim().toLowerCase();
  const name = item.name.trim().toLowerCase();
  const rule = RULES.find(
    (r) => r.keywords.some((k) => name.includes(k)) && !(r.exclude ?? []).some((e) => name.includes(e)),
  );
  const rounded = (rule ? roundByRule(rule, item.amount, unit) : null) ?? roundCountUnit(item.amount, unit);
  if (!rounded) return item;
  const estPrice =
    typeof item.estPrice === 'number' ? Math.round(item.estPrice * rounded.factor * 100) / 100 : item.estPrice;
  return { ...item, amount: rounded.amount, unit: rounded.unit, estPrice };
}

/** Wie {@link roundToPackage} für eine ganze Liste. */
export function roundItemsToPackages(items: readonly ShoppingItem[]): ShoppingItem[] {
  return items.map(roundToPackage);
}
