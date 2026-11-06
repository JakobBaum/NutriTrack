import { Recipe, ShoppingItem } from '../models';
import { withCategories } from './shopping-category';

/** Rundet eine Menge auf max. 2 Nachkommastellen (hübsche Anzeige). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalisiert einen Zutat-Namen für das Zusammenführen (Merge-Key). */
function mergeKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

/** Ganze Zahl >= 1; nicht endliche Werte (NaN, Infinity) zählen als 1. */
function safeCount(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
}

/** Gültige Portionenzahl eines Rezepts (auch 0,5 / 2,5); sonst 1. */
function safeServings(servings: number): number {
  return Number.isFinite(servings) && servings > 0 ? servings : 1;
}

/**
 * Erzeugt deterministisch Einkaufslisten-Positionen aus vorhandenen Rezepten.
 *
 * Es werden die ersten `dishes` Rezepte gewählt, ihre Zutaten auf `persons`
 * skaliert (`persons / servings`) und gleiche Positionen (Name + Einheit)
 * zusammengefasst. Ohne Rezepte bleibt die Liste leer.
 *
 * Dient als lokaler Fallback — später kann der AiProvider dies ersetzen.
 */
export function buildShoppingList(
  recipes: Recipe[],
  dishes: number,
  persons: number,
): { items: ShoppingItem[]; suggestedDishes: string[] } {
  const safeDishes = safeCount(dishes);
  const safePersons = safeCount(persons);

  if (recipes.length === 0) return { items: [], suggestedDishes: [] };

  const chosen = recipes.slice(0, safeDishes);
  const merged = new Map<string, ShoppingItem>();

  for (const recipe of chosen) {
    const factor = safePersons / safeServings(recipe.servings);
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
    items: withCategories([...merged.values()]),
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
  const safePersons = safeCount(persons);
  const safeDays = Math.max(1, Math.floor(days));
  const slots = safeDays * Math.max(1, Math.floor(mealsPerDay));

  // Ohne Rezepte gibt es nichts zu planen (keine erfundene Standardliste).
  if (recipes.length === 0) return { items: [], suggestedDishes: [] };

  const chosen: Recipe[] = [];
  for (let i = 0; i < slots; i++) chosen.push(recipes[i % recipes.length]);

  const merged = new Map<string, ShoppingItem>();
  for (const recipe of chosen) {
    const factor = safePersons / safeServings(recipe.servings);
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
  return { items: withCategories([...merged.values()]), suggestedDishes: titles };
}
