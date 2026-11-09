import { ShoppingItem } from '../core/models';
import { SHOPPING_CATEGORIES } from '../core/shopping/shopping-category';
import { DEFAULT_UNIT_SYSTEM, UnitSystem, formatQuantity } from '../core/shopping/units/unit-format';

/** Eine Position samt Index in der gespeicherten Liste. */
export interface ShoppingRow {
  item: ShoppingItem;
  index: number;
}

/** Eine Gruppe offener Positionen; `category` null = ungruppiert. */
export interface ShoppingGroup {
  category: string | null;
  rows: ShoppingRow[];
}

/** Sammelgruppe für Positionen ohne Kategorie, wenn andere eine haben. */
export const FALLBACK_CATEGORY = 'Sonstiges';

/** Standard-Personenzahl, wenn weder Profil noch Liste eine liefern. */
export const DEFAULT_PERSONS = 2;

/** Optionale Supermarkt-Kategorie (z. B. von der KI); das Basismodell kennt sie nicht. */
export function categoryOf(item: ShoppingItem): string | null {
  const raw = (item as ShoppingItem & { category?: unknown }).category;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/** Teilt Zeilen in offene und erledigte, Reihenfolge bleibt erhalten. */
export function splitRows(rows: readonly ShoppingRow[]): { open: ShoppingRow[]; done: ShoppingRow[] } {
  return {
    open: rows.filter((r) => !r.item.checked),
    done: rows.filter((r) => r.item.checked),
  };
}

/**
 * Feste Supermarkt-Reihenfolge (Obst & Gemüse zuerst, Sonstiges zuletzt); unbekannte
 * Kategorien folgen in Reihenfolge des ersten Auftretens vor „Sonstiges“.
 */
export function sortCategories(categories: readonly string[]): string[] {
  const known = (c: string): number => SHOPPING_CATEGORIES.findIndex((k) => k === c);
  const fixed = categories.filter((c) => known(c) >= 0 && c !== FALLBACK_CATEGORY).sort((a, b) => known(a) - known(b));
  const unknown = categories.filter((c) => known(c) < 0);
  return [...fixed, ...unknown, ...categories.filter((c) => c === FALLBACK_CATEGORY)];
}

/** Überschrift einer Kategorie: Schrägstriche als Aufzählung („Kühlregal, Milchprodukte“). */
export function categoryLabel(category: string): string {
  return category.replace(/\s*\/\s*/g, ', ');
}

/**
 * Gruppiert nach Kategorie in fester Supermarkt-Reihenfolge; ohne jede
 * Kategorie bleibt es eine ungruppierte Gruppe in Originalreihenfolge.
 * Positionen ohne Kategorie landen dann am Ende unter „Sonstiges“.
 */
export function groupByCategory(rows: readonly ShoppingRow[]): ShoppingGroup[] {
  if (rows.length === 0) return [];
  if (!rows.some((r) => categoryOf(r.item) !== null)) return [{ category: null, rows: [...rows] }];
  const order: string[] = [];
  const byCategory = new Map<string, ShoppingRow[]>();
  for (const row of rows) {
    const category = categoryOf(row.item) ?? FALLBACK_CATEGORY;
    if (!byCategory.has(category)) order.push(category);
    byCategory.set(category, [...(byCategory.get(category) ?? []), row]);
  }
  const sorted = sortCategories(order);
  return sorted.map((category) => ({ category, rows: byCategory.get(category) ?? [] }));
}

/** Menge als Text im Einheitensystem ("0,5 kg" / "1,1 lb"); null bei "ohne Menge". */
export function formatAmount(item: ShoppingItem, system: UnitSystem = DEFAULT_UNIT_SYSTEM): string | null {
  if (!(item.amount > 0)) return null;
  return formatQuantity(item.amount, item.unit, item.name, system);
}

/** Klartext-Liste der offenen Positionen zum Teilen, nach Kategorie gruppiert. */
export function formatShareText(
  items: readonly ShoppingItem[],
  title = 'Einkaufsliste',
  system: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const rows = items.map((item, index) => ({ item, index })).filter((r) => !r.item.checked);
  const line = (r: ShoppingRow): string => {
    const amount = formatAmount(r.item, system);
    return amount ? `- ${r.item.name} (${amount})` : `- ${r.item.name}`;
  };
  const blocks = groupByCategory(rows).map((g) => {
    const lines = g.rows.map(line).join('\n');
    return g.category ? `${g.category}:\n${lines}` : lines;
  });
  return [title, ...blocks].join('\n\n');
}

/**
 * Indizes, die nach dem endgültigen Entfernen von `removed` an die Stelle von
 * `index` rücken (für Löschen, während ein anderes Löschen noch offen ist).
 */
export function adjustIndex(index: number, removed: readonly number[]): number {
  return index - removed.filter((r) => r < index).length;
}

/** Kodiert Indizes für {@link UndoableDelete} (eine ID = Komma-Liste). */
export function encodeIndexes(indexes: readonly number[]): string {
  return indexes.join(',');
}

/** Gegenstück zu {@link encodeIndexes}; ungültige Teile werden ignoriert. */
export function decodeIndexes(id: string | null): number[] {
  if (!id) return [];
  return id
    .split(',')
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/** Ganze Zahl ab 1 oder null. */
function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Vorbelegung „Personen“: Haushaltsgröße aus dem Profil (falls vorhanden),
 * sonst die letzte Liste, sonst {@link DEFAULT_PERSONS}.
 */
export function defaultPersons(profile: object | null, lastListPersons?: number): number {
  const fromProfile = profile as { householdSize?: unknown; persons?: unknown } | null;
  return (
    positiveInt(fromProfile?.householdSize) ??
    positiveInt(fromProfile?.persons) ??
    positiveInt(lastListPersons) ??
    DEFAULT_PERSONS
  );
}

/** Gängige Wochen-Budgets (EUR) als Schnellwahl; null = „egal“ steht separat daneben. */
export const BUDGET_PRESETS: readonly number[] = [50, 75, 100, 150];

/** Schnellwahl für die Tage; andere Werte (1–14) über den Stepper. */
export const DAY_PRESETS: readonly number[] = [1, 3, 5, 7];

export const PERSONS_MIN = 1;
export const PERSONS_MAX = 8;
export const DAYS_MIN = 1;
export const DAYS_MAX = 14;

/** Personenzahl-Vorbelegung innerhalb des Steppers (1–8). */
export function defaultPersonsInRange(profile: object | null, lastListPersons?: number): number {
  return Math.min(PERSONS_MAX, Math.max(PERSONS_MIN, defaultPersons(profile, lastListPersons)));
}

/**
 * Zutaten eines Rezepts als Einkaufspositionen, auf `persons` skaliert
 * (`persons / servings`). Selbst hinzugefügt (`manual`), ohne Preis.
 */
export function scaleRecipeIngredients(
  recipe: { servings: number; ingredients: readonly { name: string; amount: number; unit: string }[] },
  persons: number,
): ShoppingItem[] {
  const servings = Number.isFinite(recipe.servings) && recipe.servings > 0 ? recipe.servings : 1;
  const factor = persons / servings;
  return recipe.ingredients
    .filter((ing) => ing.name.trim() !== '')
    .map((ing) => ({
      name: ing.name.trim(),
      amount: Math.round(ing.amount * factor * 100) / 100,
      unit: ing.unit.trim() || 'g',
      checked: false,
      manual: true,
    }));
}
