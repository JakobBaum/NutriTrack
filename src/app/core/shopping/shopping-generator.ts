import { Recipe, ShoppingItem } from '../models';
import { withCategories } from './shopping-category';
import { itemKey, normalizeUnit } from './shopping-units';

/** Rundet eine Menge auf max. 2 Nachkommastellen (hübsche Anzeige). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
 * Summiert die Zutaten der Rezepte auf `persons` skaliert. Gleiche Ware (Name +
 * normalisierte Einheit: g/kg, ml/l, Stk/Stück) wird zu einer Position addiert.
 */
function mergeIngredients(recipes: readonly Recipe[], persons: number): ShoppingItem[] {
  const merged = new Map<string, ShoppingItem>();
  for (const recipe of recipes) {
    const factor = persons / safeServings(recipe.servings);
    for (const ing of recipe.ingredients) {
      const key = itemKey(ing.name, ing.unit);
      const norm = normalizeUnit(ing.amount * factor, ing.unit);
      const existing = merged.get(key);
      merged.set(
        key,
        existing
          ? { ...existing, amount: round2(existing.amount + norm.amount) }
          : { name: ing.name.trim(), amount: round2(norm.amount), unit: norm.unit, checked: false },
      );
    }
  }
  return [...merged.values()];
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
  if (recipes.length === 0) return { items: [], suggestedDishes: [] };

  const chosen = recipes.slice(0, safeCount(dishes));
  return {
    items: withCategories(mergeIngredients(chosen, safeCount(persons))),
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
  const slots = Math.max(1, Math.floor(days)) * Math.max(1, Math.floor(mealsPerDay));

  // Ohne Rezepte gibt es nichts zu planen (keine erfundene Standardliste).
  if (recipes.length === 0) return { items: [], suggestedDishes: [] };

  const chosen: Recipe[] = [];
  for (let i = 0; i < slots; i++) chosen.push(recipes[i % recipes.length]);

  const titles = [...new Set(chosen.map((r) => r.title))];
  return { items: withCategories(mergeIngredients(chosen, safeCount(persons))), suggestedDishes: titles };
}
