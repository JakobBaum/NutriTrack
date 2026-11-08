/** Suchfilter der Online-Rezeptsuche (UI-Zustand). */
export interface OnlineSearchFilters {
  query: string;
  /** Obergrenze kcal je Portion; null = kein Limit. */
  maxCalories: number | null;
  /** Obergrenze Zubereitungszeit in Minuten; null = beliebig. */
  maxReadyTime: number | null;
  /** Spoonacular-Wert der Ernährungsform; '' = alle. */
  diet: string;
  /** Gerichtstyp (Allowlist {@link SPOON_TYPES}); leer/fehlend = alle. */
  type?: string;
  /** Mindest-Eiweiß in g je Portion; null/fehlend = kein Minimum. */
  minProtein?: number | null;
  /** Sortierung (Allowlist {@link SPOON_SORTS}); leer/fehlend = Standard des Anbieters. */
  sort?: string;
}

/** Erlaubte Gerichtstypen (identisch mit der Worker-Allowlist). */
export const SPOON_TYPES: readonly string[] = [
  'main course', 'side dish', 'dessert', 'appetizer', 'salad', 'bread', 'breakfast',
  'soup', 'beverage', 'sauce', 'marinade', 'fingerfood', 'snack', 'drink',
];

/** Erlaubte Sortierungen (identisch mit der Worker-Allowlist). */
export const SPOON_SORTS: readonly string[] = ['healthiness', 'popularity', 'random'];

export const DEFAULT_PAGE_SIZE = 10;

export const EMPTY_FILTERS: OnlineSearchFilters = { query: '', maxCalories: null, maxReadyTime: null, diet: '' };

/** Ernährungsformen (Label deutsch, Wert wie von Spoonacular erwartet). */
export const DIET_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescetarian', label: 'Pescetarisch' },
  { value: 'gluten free', label: 'Glutenfrei' },
  { value: 'ketogenic', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

/** Zeitlimits in Minuten (Wert 0 = beliebig). */
export const TIME_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Beliebig' },
  { value: 15, label: 'bis 15 Min' },
  { value: 30, label: 'bis 30 Min' },
  { value: 45, label: 'bis 45 Min' },
  { value: 60, label: 'bis 60 Min' },
];

export const KCAL_LIMIT = { min: 100, max: 1500, step: 50, start: 600 } as const;

function positive(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Baut die Query-Parameter für `complexSearch`. Mit `fillIngredients` +
 * `addRecipeNutrition` + `addRecipeInstructions` kommt alles in einer Antwort,
 * `instructionsRequired` blendet Rezepte ohne Anleitung aus.
 * `withDetails = false` ergibt die billigste Anfrage (nur `number`), z. B. für den Verbindungstest.
 */
export function buildSearchParams(
  filters: OnlineSearchFilters,
  offset = 0,
  number = DEFAULT_PAGE_SIZE,
  withDetails = true,
): Record<string, string> {
  const params: Record<string, string> = { number: String(number) };
  if (!withDetails) return params;
  if (offset > 0) params['offset'] = String(offset);
  const query = filters.query.trim();
  if (query) params['query'] = query;
  if (positive(filters.maxCalories)) params['maxCalories'] = String(Math.round(filters.maxCalories));
  if (positive(filters.maxReadyTime)) params['maxReadyTime'] = String(Math.round(filters.maxReadyTime));
  if (filters.diet.trim()) params['diet'] = filters.diet.trim();
  if (positive(filters.minProtein ?? null)) params['minProtein'] = String(Math.round(filters.minProtein as number));
  const type = (filters.type ?? '').trim().toLowerCase();
  if (SPOON_TYPES.includes(type)) params['type'] = type;
  const sort = (filters.sort ?? '').trim().toLowerCase();
  // Gesündeste/beliebteste zuerst: absteigend, sonst käme das Ungesündeste zuerst.
  if (SPOON_SORTS.includes(sort)) {
    params['sort'] = sort;
    if (sort !== 'random') params['sortDirection'] = 'desc';
  }
  params['addRecipeNutrition'] = 'true';
  params['addRecipeInstructions'] = 'true';
  params['fillIngredients'] = 'true';
  params['instructionsRequired'] = 'true';
  return params;
}

/** Liest „X-Api-Quota-Left“ (verbleibende Punkte heute); fehlend/ungültig → null. */
export function parseQuotaLeft(header: string | null | undefined): number | null {
  if (header === null || header === undefined || header.trim() === '') return null;
  const n = Number(header);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
