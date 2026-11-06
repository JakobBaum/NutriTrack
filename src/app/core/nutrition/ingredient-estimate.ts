import { NutritionFacts } from '../models';
import { canonicalUnitKey, unitGrams } from './units-weight';

/**
 * Deterministische Nährwert-Schätzung für gängige Zutaten (offline, ohne KI).
 * Dient dem Mock-Import als Ersatz für die KI-Berechnung: bekannte Zutaten
 * bekommen plausible Nährwerte je 100 g, unbekannte bleiben ohne Werte
 * (→ „manuell eintragen"). Die echte KI (Gemini) rechnet im Live-Betrieb.
 */

/** Nährwertdichte je 100 g einer Zutat. */
interface Density {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
}

/** Einheiten, die 1:1 als Gramm/Milliliter gelten (→ Bezug per100g). */
const GRAM_UNITS = new Set(['g', 'gramm', 'gr', 'kg', 'kilogramm', 'ml', 'milliliter', 'l', 'liter']);

/** Keyword → Dichte. Längster Treffer am Wortanfang/-ende (case-insensitive) gewinnt. */
const TABLE: { keywords: string[]; exclude?: string[]; d: Density }[] = [
  { keywords: ['mehl'], d: { kcal: 364, proteinG: 10, carbsG: 76, fatG: 1, fiberG: 2.7, sugarG: 0.3 } },
  { keywords: ['haferflocken', 'hafer'], d: { kcal: 389, proteinG: 13, carbsG: 66, fatG: 7, fiberG: 10, sugarG: 1 } },
  { keywords: ['zucker'], d: { kcal: 400, proteinG: 0, carbsG: 100, fatG: 0, fiberG: 0, sugarG: 100 } },
  { keywords: ['ei', 'eier', 'hühnerei'], exclude: ['eiswürfel', 'eisbergsalat', 'eiweißpulver'], d: { kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0, sugarG: 1.1 } },
  { keywords: ['milch'], exclude: ['kokos', 'mandel', 'soja', 'hafermilch', 'reismilch'], d: { kcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.6, fiberG: 0, sugarG: 4.8 } },
  { keywords: ['sahne', 'rahm'], d: { kcal: 292, proteinG: 2.4, carbsG: 3.4, fatG: 30, fiberG: 0, sugarG: 3.4 } },
  { keywords: ['joghurt', 'jogurt'], d: { kcal: 61, proteinG: 3.5, carbsG: 4.7, fatG: 3.3, fiberG: 0, sugarG: 4.7 } },
  { keywords: ['butter'], exclude: ['erdnuss', 'mandel', 'nuss', 'buttermilch'], d: { kcal: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81, fiberG: 0, sugarG: 0.1 } },
  { keywords: ['öl', 'ol', 'olivenöl', 'olivenol'], d: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0, sugarG: 0 } },
  { keywords: ['käse', 'kase', 'gouda', 'parmesan'], d: { kcal: 402, proteinG: 25, carbsG: 1.3, fatG: 33, fiberG: 0, sugarG: 0.5 } },
  { keywords: ['reis'], d: { kcal: 360, proteinG: 7, carbsG: 78, fatG: 1, fiberG: 1.3, sugarG: 0.1 } },
  { keywords: ['nudel', 'pasta', 'spaghetti', 'penne'], d: { kcal: 371, proteinG: 13, carbsG: 75, fatG: 1.5, fiberG: 3, sugarG: 3 } },
  { keywords: ['kartoffel', 'erdapfel'], d: { kcal: 77, proteinG: 2, carbsG: 17, fatG: 0.1, fiberG: 2.2, sugarG: 0.8 } },
  { keywords: ['zwiebel'], d: { kcal: 40, proteinG: 1.1, carbsG: 9, fatG: 0.1, fiberG: 1.7, sugarG: 4.2 } },
  { keywords: ['knoblauch'], d: { kcal: 149, proteinG: 6, carbsG: 33, fatG: 0.5, fiberG: 2, sugarG: 1 } },
  { keywords: ['tomate'], d: { kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, fiberG: 1.2, sugarG: 2.6 } },
  { keywords: ['hähnchen', 'haehnchen', 'huhn', 'hühner', 'chicken'], d: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, sugarG: 0 } },
  { keywords: ['rind', 'hack', 'beef'], d: { kcal: 250, proteinG: 26, carbsG: 0, fatG: 15, fiberG: 0, sugarG: 0 } },
  { keywords: ['linsen'], d: { kcal: 352, proteinG: 25, carbsG: 60, fatG: 1, fiberG: 11, sugarG: 2 } },
  { keywords: ['bohnen', 'kichererbsen'], d: { kcal: 333, proteinG: 21, carbsG: 60, fatG: 1.5, fiberG: 15, sugarG: 2 } },
  { keywords: ['banane'], d: { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, fiberG: 2.6, sugarG: 12 } },
  { keywords: ['apfel', 'äpfel'], d: { kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2, fiberG: 2.4, sugarG: 10 } },
  { keywords: ['salz'], d: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 } },
  { keywords: ['wasser'], d: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 } },
];

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Wortteile (Buchstaben/Ziffern), damit Keywords nicht mitten im Wort treffen. */
function tokenize(name: string): string[] {
  return name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
}

/** Kürzeste Keywords, die auch als Wortteil (Anfang/Ende) treffen dürfen. */
const MIN_AFFIX_LENGTH = 4;

/** Kurze Keywords („ei“, „öl“) nur als ganzes Wort; ab 4 Zeichen auch am Wortanfang/-ende (Komposita), nie mittendrin. */
function matchesToken(token: string, keyword: string): boolean {
  if (token === keyword) return true;
  return keyword.length >= MIN_AFFIX_LENGTH && (token.startsWith(keyword) || token.endsWith(keyword));
}

/** Beste Tabellenzeile je Wort (längstes Keyword, ohne Ausschlüsse). */
function rowForToken(token: string): { d: Density; row: number } | undefined {
  let best: { len: number; d: Density; row: number } | undefined;
  TABLE.forEach((row, index) => {
    if ((row.exclude ?? []).some((e) => token.includes(e))) return;
    for (const k of row.keywords) {
      if (k.length > (best?.len ?? 0) && matchesToken(token, k)) best = { len: k.length, d: row.d, row: index };
    }
  });
  return best;
}

/** Dichte, wenn genau eine Zutat erkannt wird; mehrdeutig (verschiedene Treffer) oder unbekannt → undefined. */
function findDensity(name: string): Density | undefined {
  const hits = tokenize(name).map(rowForToken).filter((h): h is { d: Density; row: number } => !!h);
  const rows = new Set(hits.map((h) => h.row));
  return rows.size === 1 ? hits[0].d : undefined;
}

/**
 * Schätzt die Nährwerte einer Zutat anhand ihres Namens und ihrer Einheit.
 *
 * - Bei g/ml-Einheiten → Dichte je 100 g (basis `per100g`).
 * - Bei Stück/Löffel-Einheiten → Nährwerte je 1 Einheit (basis `perPortion`,
 *   `portionG` = geschätztes Einheitsgewicht), damit die bestehende
 *   Mengen-Skalierung in `recipe-nutrition.ts` korrekt greift.
 * - Unbekannte Zutat → `undefined` (bleibt „manuell").
 */
export function estimateIngredientFacts(
  name: string,
  unit: string,
): NutritionFacts | undefined {
  const density = findDensity(name ?? '');
  if (!density) return undefined;

  const u = (unit || 'g').trim().toLowerCase();
  if (GRAM_UNITS.has(u)) {
    return {
      kcal: Math.round(density.kcal),
      proteinG: round1(density.proteinG),
      carbsG: round1(density.carbsG),
      fatG: round1(density.fatG),
      fiberG: round1(density.fiberG),
      sugarG: round1(density.sugarG),
      basis: 'per100g',
    };
  }

  const grams = canonicalUnitKey(unit) ? unitGrams(unit, name) : undefined;
  if (grams === undefined) return undefined;
  const factor = grams / 100;
  return {
    kcal: Math.round(density.kcal * factor),
    proteinG: round1(density.proteinG * factor),
    carbsG: round1(density.carbsG * factor),
    fatG: round1(density.fatG * factor),
    fiberG: round1(density.fiberG * factor),
    sugarG: round1(density.sugarG * factor),
    basis: 'perPortion',
    portionG: grams,
  };
}
