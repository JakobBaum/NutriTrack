import { ShoppingItem } from '../models';
import { estimateItemPrice } from '../shopping/ingredient-price';
import { round2 } from '../shopping/round2';
import { fromNormalized, itemKey, normalizeUnit } from '../shopping/shopping-units';
import { ensureItemIds } from './shopping-sanitize';

/** Setzt die Schätzung einer Position anhand ihrer aktuellen Menge neu; ein eigener Preis bleibt unberührt. */
export function repriced(it: ShoppingItem): ShoppingItem {
  return { ...it, estPrice: estimateItemPrice(it) };
}

const keyOf = (it: ShoppingItem): string => itemKey(it.name, it.unit);

/** Menge einer Position in der Basiseinheit (g, ml, Stk, ...), damit g/kg usw. vergleichbar sind. */
const baseAmount = (it: ShoppingItem): number => normalizeUnit(it.amount, it.unit).amount;

/** Preise zweier Positionen addieren; fehlt einer, zählt der vorhandene. */
function sumPrice(a?: number, b?: number): number | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return round2(a + b);
}

/** Fasst mehrere behaltene Positionen derselben Ware (Name + Einheitenfamilie) zu einer zusammen. */
function collapseDuplicates(items: readonly ShoppingItem[]): ShoppingItem[] {
  const byKey = new Map<string, ShoppingItem>();
  for (const it of items) {
    const key = keyOf(it);
    const first = byKey.get(key);
    if (!first) {
      byKey.set(key, it);
      continue;
    }
    const amount = round2(first.amount + fromNormalized(baseAmount(it), first.unit));
    byKey.set(key, repriced({
      ...first,
      amount,
      checked: first.checked && it.checked,
      userPrice: sumPrice(first.userPrice, it.userPrice),
      category: first.category ?? it.category,
    }));
  }
  return [...byKey.values()];
}

/**
 * Vereinheitlicht und summiert Positionen derselben Ware (Name + Einheitenfamilie) NACH dem Aufrunden auf
 * Packungen: so entsteht aus "300 g Zwiebel" und "2 Stk Zwiebel" eine Zeile. Schätzpreise werden addiert.
 */
export function mergeSameGoods(items: readonly ShoppingItem[]): ShoppingItem[] {
  const byKey = new Map<string, ShoppingItem>();
  for (const it of items) {
    const key = keyOf(it);
    const first = byKey.get(key);
    if (!first) {
      byKey.set(key, it);
      continue;
    }
    byKey.set(key, {
      ...first,
      amount: round2(first.amount + fromNormalized(baseAmount(it), first.unit)),
      estPrice: sumPrice(first.estPrice, it.estPrice),
      userPrice: sumPrice(first.userPrice, it.userPrice),
    });
  }
  return [...byKey.values()];
}

/** Eigener Preis, an die neue Menge angepasst (Preis je Einheit bleibt gleich); ohne Mengenbezug unverändert. */
function scaledUserPrice(price: number | undefined, fromBase: number, toBase: number): number | undefined {
  if (price == null || !(fromBase > 0) || !(toBase > 0)) return price;
  return round2((price * toBase) / fromBase);
}

/**
 * Führt eine behaltene Position mit der generierten gleichen Ware zusammen: Es gilt die größere
 * Menge (Einheit der behaltenen Position); wächst der Bedarf, wird die Position wieder offen
 * und ein eigener Preis wächst mit der Menge.
 */
function mergeOne(old: ShoppingItem, g: ShoppingItem): ShoppingItem {
  const needBase = baseAmount(g);
  const oldBase = baseAmount(old);
  const grows = old.amount <= 0 || needBase > oldBase;
  const amount = grows ? round2(fromNormalized(needBase, old.unit)) : old.amount;
  const category = old.category ?? g.category;
  const checked = grows ? false : old.checked;
  const base: ShoppingItem = { ...old, amount, category, checked };
  const scaled = grows ? scaledUserPrice(old.userPrice, oldBase, needBase) : old.userPrice;
  // Die Schätzung folgt der Menge; ein eigener Preis (userPrice) der behaltenen Position bleibt erhalten.
  return repriced(scaled === undefined ? base : { ...base, userPrice: scaled });
}

/** Eigene Preise nicht behaltener (erzeugter) Positionen je Ware: sie wandern auf die neu erzeugte gleiche Ware. */
function pricedLeftovers(previous: readonly ShoppingItem[], isKept: (it: ShoppingItem) => boolean): Map<string, ShoppingItem> {
  const map = new Map<string, ShoppingItem>();
  for (const it of previous) {
    if (!isKept(it) && it.userPrice != null && !map.has(keyOf(it))) map.set(keyOf(it), it);
  }
  return map;
}

function carryUserPrice(g: ShoppingItem, from: ShoppingItem | undefined): ShoppingItem {
  if (!from || g.userPrice != null) return g;
  const userPrice = scaledUserPrice(from.userPrice, baseAmount(from), baseAmount(g));
  return userPrice === undefined ? g : { ...g, userPrice };
}

/**
 * Übernimmt beim Neu-Generieren abgehakte und manuelle Positionen (manuell =
 * Markierung `manual` oder ohne Schätzpreis). Gleiche Ware (Name + Einheitenfamilie)
 * ersetzt die neu generierte Position; die größere Menge gewinnt, mehrere manuelle Duplikate werden addiert.
 * Ein eigener Preis auf einer erzeugten, nicht abgehakten Position wandert auf die gleiche neu erzeugte Ware.
 */
export function mergeKept(
  previous: readonly ShoppingItem[],
  generated: readonly ShoppingItem[],
): ShoppingItem[] {
  // `manual: false` markiert generierte Positionen: ohne Preis trotzdem ersetzbar.
  const isKept = (it: ShoppingItem): boolean => it.checked || it.manual === true || (it.estPrice == null && it.manual !== false);
  const kept = collapseDuplicates(previous.filter(isKept));
  const byKey = new Map(kept.map((it) => [keyOf(it), it] as const));
  const leftovers = pricedLeftovers(previous, isKept);
  const used = new Set<string>();
  const merged = generated.map((g) => {
    const key = keyOf(g);
    const old = byKey.get(key);
    if (!old || used.has(key)) return carryUserPrice(g, leftovers.get(key));
    used.add(key);
    return mergeOne(old, g);
  });
  const rest = kept.filter((it) => !used.has(keyOf(it)));
  return [...merged, ...rest];
}

/**
 * Gibt jeder Position der neuen Liste eine id: Positionen ohne id übernehmen die id der gleichen Ware
 * aus der alten Liste (ein offenes „Rückgängig“ trifft sie weiter), alle übrigen bekommen eine neue.
 */
export function assignIds(previous: readonly ShoppingItem[], next: readonly ShoppingItem[]): ShoppingItem[] {
  const taken = new Set(next.map((it) => it.id).filter((id): id is string => !!id));
  const pool = new Map<string, string>();
  for (const it of previous) {
    if (it.id && !taken.has(it.id) && !pool.has(keyOf(it))) pool.set(keyOf(it), it.id);
  }
  const inherited = next.map((it) => {
    if (it.id) return it;
    const id = pool.get(keyOf(it));
    if (!id) return it;
    pool.delete(keyOf(it));
    return { ...it, id };
  });
  return ensureItemIds(inherited);
}
