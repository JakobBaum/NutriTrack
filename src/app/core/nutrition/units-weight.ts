import { NutritionFacts, RecipeIngredient } from '../models';

/**
 * EINE gemeinsame Gewichtstabelle (Gramm je Einheit) für Nährwert-Schätzung,
 * Rezept-Skalierung und Einkaufs-Rundung. EL, TL, Stk … sind Näherungswerte.
 */
export const UNIT_WEIGHT_G: Readonly<Record<string, number>> = {
  g: 1, kg: 1000, ml: 1, l: 1000,
  EL: 15, TL: 5, Prise: 1, Zehe: 5,
  Stk: 80, Pck: 100, Dose: 400, Bund: 50,
  Scheibe: 25, Tasse: 240,
};

/** Einheiten, die 1:1 als Gramm/Milliliter gelten (Bezug je 100 g), in Kleinschreibung. */
export const GRAM_UNITS: ReadonlySet<string> = new Set([
  'g', 'gramm', 'gr', 'kg', 'kilogramm', 'ml', 'milliliter', 'l', 'liter',
]);

/** Schreibweisen (klein) → Schlüssel der Tabelle. */
const UNIT_ALIASES: Readonly<Record<string, string>> = {
  gramm: 'g', gr: 'g', kilogramm: 'kg', milliliter: 'ml', liter: 'l',
  el: 'EL', tl: 'TL', prise: 'Prise', prisen: 'Prise', zehe: 'Zehe', zehen: 'Zehe',
  stk: 'Stk', stück: 'Stk', pck: 'Pck', packung: 'Pck', dose: 'Dose', dosen: 'Dose',
  bund: 'Bund', scheibe: 'Scheibe', scheiben: 'Scheibe', tasse: 'Tasse', tassen: 'Tasse',
};

/** Stückgewicht bestimmter Zutaten (Gramm je Stk); alles andere gilt als generisches Stück. */
const PIECE_WEIGHT_BY_NAME: readonly { keywords: readonly string[]; g: number }[] = [
  { keywords: ['zwiebel'], g: 80 },
  { keywords: ['ei', 'eier', 'hühnerei'], g: 60 },
];

/** Gewicht eines Zwiebel-Stücks (auch für die Einkaufs-Rundung). */
export const ONION_PIECE_G = 80;

function tokens(name: string): string[] {
  return name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
}

/** Schlüssel der Gewichtstabelle für eine beliebige Schreibweise (oder undefined). */
export function canonicalUnitKey(unit: string): string | undefined {
  const raw = (unit ?? '').trim();
  if (raw in UNIT_WEIGHT_G) return raw;
  const lower = raw.toLowerCase();
  return UNIT_ALIASES[lower] ?? (lower in UNIT_WEIGHT_G ? lower : undefined);
}

/** Gramm je Einheit; bei „Stk“ mit Namensbezug (Ei 60 g, Zwiebel 80 g). Unbekannte Einheit → undefined. */
export function unitGrams(unit: string, name = ''): number | undefined {
  const key = canonicalUnitKey(unit);
  if (!key) return undefined;
  if (key === 'Stk') {
    const parts = tokens(name);
    const hit = PIECE_WEIGHT_BY_NAME.find((p) => parts.some((t) => p.keywords.some((k) => t === k || (k.length >= 4 && t.endsWith(k)))));
    if (hit) return hit.g;
  }
  return UNIT_WEIGHT_G[key];
}

/** True, wenn kcal angegeben, aber Eiweiß/KH/Fett alle 0 sind (nur kcal eingetippt → „Nährwerte unvollständig“). */
export function hasIncompleteFacts(facts: NutritionFacts | undefined): boolean {
  return !!facts && (facts.kcal || 0) > 0 && !(facts.proteinG > 0) && !(facts.carbsG > 0) && !(facts.fatG > 0);
}

/**
 * True, wenn die Werte je 100 g gelten, die Einheit der Zutat aber unbekannt ist (z. B. "Msp"): ihr Gewicht ist
 * nicht bekannt, die Nährwerte lassen sich nicht berechnen und zählen als fehlend.
 */
export function hasUnknownUnitForPer100g(
  ingredient: Partial<Pick<RecipeIngredient, 'unit' | 'name'>> & Pick<RecipeIngredient, 'facts'>,
): boolean {
  if (ingredient.facts?.basis !== 'per100g') return false;
  const unit = (ingredient.unit ?? '').trim() || 'g';
  return unitGrams(unit, ingredient.name ?? '') === undefined;
}

/** Anzahl Zutaten ohne (vollständige) Nährwerte; sie zählen in der Summe nur mit, was bekannt ist. */
export function countMissingFacts(
  ingredients: readonly (Partial<Pick<RecipeIngredient, 'unit' | 'name'>> & Pick<RecipeIngredient, 'facts'>)[],
): number {
  return ingredients.filter((i) => !i.facts || hasIncompleteFacts(i.facts) || hasUnknownUnitForPer100g(i)).length;
}
