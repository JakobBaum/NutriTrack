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
