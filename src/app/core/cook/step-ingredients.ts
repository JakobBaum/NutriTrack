import { normalizeText, tokenize } from './cook-text';

/** Mindestlänge eines Wortes, damit Beugungsendungen (Plural) erlaubt sind. */
const MIN_STEM_FOR_SUFFIX = 3;
/** Sehr kurze Wörter (Ei, Öl) beugen nur mit diesen Endungen (Eier, Eiern). */
const SHORT_WORD_SUFFIXES: readonly string[] = ['er', 'ern'];
/** Deutsche und englische Beugungsendungen (Plural, Fall). */
const WORD_SUFFIXES: readonly string[] = ['s', 'e', 'n', 'en', 'er', 'ern', 'es'];
/** Hauptwörter, die allein zu allgemein sind: dann zählt auch das Wort davor (olive oil). */
const GENERIC_HEADS: ReadonlySet<string> = new Set([
  'oil', 'ol', 'sauce', 'sosse', 'paste', 'powder', 'pulver', 'stock', 'bruhe', 'broth', 'cheese', 'kase',
  'juice', 'saft', 'breast', 'brust', 'fillet', 'filet', 'flour', 'mehl',
]);

/** Füllwörter, Mengen- und Zubereitungswörter, die nie das Hauptwort sind. */
const FILLER_WORDS: readonly string[] = [
  'etwas', 'wenig', 'viel', 'ein', 'eine', 'einen', 'der', 'die', 'das', 'dem', 'den', 'mit', 'aus', 'fur', 'von', 'zum', 'zur',
  'nach', 'belieben', 'geschmack', 'optional', 'evtl', 'ca', 'etwa', 'bio', 'frisch', 'getrocknet', 'gehackt', 'gewurfelt',
  'geschnitten', 'gerieben', 'gemahlen', 'geschalt', 'gesalzen', 'ungesalzen', 'fein', 'grob', 'klein', 'gross', 'mittelgross',
  'mittel', 'reif', 'weich', 'kalt', 'warm', 'heiss', 'rot', 'weiss', 'grun', 'gelb', 'schwarz', 'ganz', 'halb', 'gestrichen', 'gehauft',
  'prise', 'bund', 'dose', 'glas', 'packung', 'packchen', 'becher', 'zehe', 'scheibe', 'stuck', 'stk', 'el', 'tl', 'essloffel', 'teeloffel', 'tasse', 'schuss', 'spritzer', 'handvoll', 'stange', 'zweig', 'gramm', 'liter', 'pck', 'pkg', 'g', 'kg', 'ml', 'l',
  'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'some', 'little', 'few', 'about', 'approx', 'fresh', 'freshly', 'chopped', 'diced',
  'sliced', 'minced', 'grated', 'ground', 'dried', 'large', 'small', 'medium', 'big', 'red', 'white', 'green', 'yellow', 'black', 'soft',
  'cold', 'warm', 'hot', 'ripe', 'whole', 'half', 'taste', 'optional', 'pinch', 'clove', 'slice', 'can', 'cup', 'tbsp', 'tsp', 'tablespoon',
  'teaspoon', 'bunch', 'piece', 'handful', 'stick', 'sprig', 'gram', 'pound', 'ounce', 'lb', 'oz',
];

/** Trennt Alternativen ("Salz und Pfeffer", "Butter oder Margarine", "a/b"). */
const ALTERNATIVE_SPLIT = /\s+(?:und|oder|and|or)\s+|\//u;

/** Erfüllt `longer` die Form `shorter` + erlaubte Endung? */
export function isInflection(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.startsWith(shorter)) return false;
  const suffix = longer.slice(shorter.length);
  if (shorter.length >= MIN_STEM_FOR_SUFFIX) {
    return WORD_SUFFIXES.includes(suffix) || (shorter.endsWith('y') && longer === `${shorter.slice(0, -1)}ies`);
  }
  return shorter.length >= 2 && SHORT_WORD_SUFFIXES.includes(suffix);
}

const FILLER_SET: ReadonlySet<string> = new Set(FILLER_WORDS.map(normalizeText));
const isFiller = (word: string): boolean =>
  FILLER_SET.has(word) || [...FILLER_SET].some((f) => f.length >= MIN_STEM_FOR_SUFFIX && isInflection(word, f));

/** Suchbegriffe einer Zutat: Hauptwort (und bei allgemeinem Hauptwort das Wort davor). */
interface Matcher {
  readonly heads: readonly string[];
}

function matcherFor(name: string): Matcher {
  const cleaned = name.replace(/\([^)]*\)/g, ' ').split(',')[0];
  const heads: string[] = [];
  for (const part of cleaned.split(ALTERNATIVE_SPLIT)) {
    const words = tokenize(part).filter((w) => !isFiller(w));
    const head = words[words.length - 1];
    if (!head) continue;
    heads.push(head);
    if (GENERIC_HEADS.has(head) && words.length > 1) heads.push(words[words.length - 2]);
  }
  return { heads };
}

const matchesStep = (matcher: Matcher, words: readonly string[]): boolean =>
  matcher.heads.some((head) => words.some((w) => isInflection(w, head)));

/** Zutaten (mit Menge), die im Schritttext vorkommen; Reihenfolge wie in der Zutatenliste. */
export function stepIngredientsFor<T extends { name: string }>(step: string, ingredients: readonly T[]): T[] {
  return matchStep(tokenize(step), ingredients, ingredients.map((i) => matcherFor(i.name)));
}

function matchStep<T>(words: readonly string[], ingredients: readonly T[], matchers: readonly Matcher[]): T[] {
  if (words.length === 0) return [];
  return ingredients.filter((_, index) => matchesStep(matchers[index], words));
}

/** Je Schritt die passenden Zutaten; die Suchbegriffe werden nur einmal berechnet. */
export function stepIngredientsByStep<T extends { name: string }>(steps: readonly string[], ingredients: readonly T[]): T[][] {
  const matchers = ingredients.map((i) => matcherFor(i.name));
  return steps.map((step) => matchStep(tokenize(step), ingredients, matchers));
}
