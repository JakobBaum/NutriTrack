import { Recipe, ShoppingItem } from '../models';

/** Rundet eine Menge auf max. 2 Nachkommastellen (hübsche Anzeige). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalisiert einen Zutat-Namen für das Zusammenführen (Merge-Key). */
function mergeKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

/** Basis-Einkaufsliste pro Person, wenn (noch) keine Rezepte vorhanden sind. */
const STAPLES_PER_PERSON: ShoppingItem[] = [
  { name: 'Nudeln', amount: 125, unit: 'g', checked: false },
  { name: 'Passierte Tomaten', amount: 200, unit: 'g', checked: false },
  { name: 'Zwiebel', amount: 1, unit: 'Stk', checked: false },
  { name: 'Knoblauch', amount: 1, unit: 'Zehe', checked: false },
  { name: 'Olivenöl', amount: 15, unit: 'ml', checked: false },
  { name: 'Parmesan', amount: 20, unit: 'g', checked: false },
  { name: 'Blattsalat', amount: 50, unit: 'g', checked: false },
];

/**
 * Erzeugt deterministisch Einkaufslisten-Positionen aus vorhandenen Rezepten.
 *
 * Es werden die ersten `dishes` Rezepte gewählt, ihre Zutaten auf `persons`
 * skaliert (`persons / servings`) und gleiche Positionen (Name + Einheit)
 * zusammengefasst. Ohne Rezepte wird eine sinnvolle Basis-Liste erzeugt.
 *
 * Dient als lokaler Fallback — später kann der AiProvider dies ersetzen.
 */
export function buildShoppingList(
  recipes: Recipe[],
  dishes: number,
  persons: number,
): { items: ShoppingItem[]; suggestedDishes: string[] } {
  const safeDishes = Math.max(1, Math.floor(dishes));
  const safePersons = Math.max(1, Math.floor(persons));

  if (recipes.length === 0) {
    const items = STAPLES_PER_PERSON.map((i) => ({
      ...i,
      amount: round2(i.amount * safePersons),
    }));
    return { items, suggestedDishes: [] };
  }

  const chosen = recipes.slice(0, safeDishes);
  const merged = new Map<string, ShoppingItem>();

  for (const recipe of chosen) {
    const factor = safePersons / Math.max(1, recipe.servings);
    for (const ing of recipe.ingredients) {
      const key = mergeKey(ing.name, ing.unit);
      const scaled = round2(ing.amount * factor);
      const existing = merged.get(key);
      if (existing) {
        merged.set(key, { ...existing, amount: round2(existing.amount + scaled) });
      } else {
        merged.set(key, {
          name: ing.name.trim(),
          amount: scaled,
          unit: ing.unit.trim(),
          checked: false,
        });
      }
    }
  }

  return {
    items: [...merged.values()],
    suggestedDishes: chosen.map((r) => r.title),
  };
}

/**
 * Baut einen Wochenplan: `days × meals.length` Gericht-Slots, zyklisch mit den
 * vorhandenen Rezepten befüllt, Zutaten auf `persons` skaliert und zusammengefasst.
 */
export function buildWeekPlan(
  recipes: Recipe[],
  persons: number,
  days: number,
  mealsPerDay: number,
): { items: ShoppingItem[]; suggestedDishes: string[] } {
  const safePersons = Math.max(1, Math.floor(persons));
  const safeDays = Math.max(1, Math.floor(days));
  const slots = safeDays * Math.max(1, Math.floor(mealsPerDay));

  if (recipes.length === 0) {
    // Ohne Rezepte: Basis-Liste grob auf Personen × Tage skaliert.
    const items = STAPLES_PER_PERSON.map((i) => ({
      ...i,
      amount: round2(i.amount * safePersons * safeDays),
    }));
    return { items, suggestedDishes: [] };
  }

  const chosen: Recipe[] = [];
  for (let i = 0; i < slots; i++) chosen.push(recipes[i % recipes.length]);

  const merged = new Map<string, ShoppingItem>();
  for (const recipe of chosen) {
    const factor = safePersons / Math.max(1, recipe.servings);
    for (const ing of recipe.ingredients) {
      const key = mergeKey(ing.name, ing.unit);
      const scaled = round2(ing.amount * factor);
      const existing = merged.get(key);
      if (existing) {
        merged.set(key, { ...existing, amount: round2(existing.amount + scaled) });
      } else {
        merged.set(key, {
          name: ing.name.trim(),
          amount: scaled,
          unit: ing.unit.trim(),
          checked: false,
        });
      }
    }
  }

  const titles = [...new Set(chosen.map((r) => r.title))];
  return { items: [...merged.values()], suggestedDishes: titles };
}

/** Markt-Faktoren für Schätzpreise (Diskonter günstiger als Vollsortimenter). */
const STORE_FACTOR: Record<string, number> = {
  lidl: 0.9,
  hofer: 0.9,
  aldi: 0.9,
  penny: 0.92,
  spar: 1.08,
  billa: 1.08,
  rewe: 1.05,
};

/**
 * Grobe, lokale Preis-Schätzung je Position (EUR). Bewusst einfach — wird später
 * durch echte Marktpreise ersetzt. `store` beeinflusst nur das Preisniveau.
 */
export function estimatePrice(item: ShoppingItem, store?: string): number {
  const unit = item.unit.trim().toLowerCase();
  let base: number; // EUR pro Einheit der Menge
  switch (unit) {
    case 'g':
      base = item.amount * 0.004; // ~0,40 €/100 g
      break;
    case 'kg':
      base = item.amount * 4.0;
      break;
    case 'ml':
      base = item.amount * 0.003; // ~0,30 €/100 ml
      break;
    case 'l':
      base = item.amount * 2.5;
      break;
    case 'stk':
    case 'stück':
      base = item.amount * 0.6;
      break;
    case 'zehe':
      base = item.amount * 0.1;
      break;
    default:
      base = item.amount * 0.5;
  }
  const factor = store ? (STORE_FACTOR[store.trim().toLowerCase()] ?? 1) : 1;
  const price = Math.max(0.1, base * factor);
  return round2(price);
}

/** Versieht Positionen mit Schätzpreisen und liefert die Gesamtsumme. */
export function priceItems(
  items: ShoppingItem[],
  store?: string,
): { items: ShoppingItem[]; estTotal: number } {
  const priced = items.map((i) => ({ ...i, estPrice: estimatePrice(i, store) }));
  const estTotal = round2(priced.reduce((s, i) => s + (i.estPrice ?? 0), 0));
  return { items: priced, estTotal };
}
