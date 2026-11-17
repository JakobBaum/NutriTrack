/** Endungen, die ein Stichwort als Mehrzahl/Fuge noch zum selben Wort machen („Nudel“ - „Nudeln“). */
const PLURAL_SUFFIX = '(?:n|en|e|s)?';

/**
 * Entfernt Akzente („crème“ -> „creme“, „jalapeño“ -> „jalapeno“); Umlaute und ß bleiben eigenständig.
 * Der Umlaut-Punkt (U+0308) hinter a, o, u bleibt erhalten, jedes andere Kombinationszeichen fällt weg.
 */
export const foldAccents = (text: string): string =>
  text.normalize('NFD').replace(/([aou]̈)|[̀-ͯ]/gi, (_m, umlaut?: string) => umlaut ?? '').normalize('NFC');

/** Wörter eines Namens (klein), getrennt an allem, was kein Buchstabe ist (Akzentbuchstaben zählen als Buchstaben). */
export const wordsOf = (name: string): string[] => name.split(/[^\p{L}]+/u).filter(Boolean);

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bereits gebaute Regex je Modus und Stichwort (wenige hundert Stichwörter, aber sehr viele Aufrufe). */
const patternCache = new Map<string, RegExp>();

function patternFor(key: string, mode: 'end' | 'edge'): RegExp {
  const cacheKey = `${mode}|${key}`;
  const cached = patternCache.get(cacheKey);
  if (cached) return cached;
  const escaped = escapeRegex(key);
  const pattern = new RegExp(mode === 'edge' ? `^${escaped}|${escaped}${PLURAL_SUFFIX}$` : `${escaped}${PLURAL_SUFFIX}$`);
  patternCache.set(cacheKey, pattern);
  return pattern;
}

/** Ein Name, einmal vorbereitet (Akzente entfernt, in Wörter zerlegt), für viele Stichwort-Prüfungen. */
export interface PreparedName {
  readonly folded: string;
  readonly words: readonly string[];
}

export function prepareName(name: string): PreparedName {
  const folded = foldAccents(name);
  return { folded, words: wordsOf(folded) };
}

/** Wie {@link matchesKeyword}, aber mit vorbereitetem Namen und bereits akzentfreiem Stichwort. */
export function matchesPrepared(name: PreparedName, foldedKeyword: string, mode: 'end' | 'edge' = 'end'): boolean {
  if (foldedKeyword.includes(' ')) return name.folded.includes(foldedKeyword);
  const pattern = patternFor(foldedKeyword, mode);
  return name.words.some((w) => pattern.test(w));
}

/**
 * Stichwort trifft nur an Wortgrenzen, nie mitten im Wort („Preiselbeeren“ trifft nicht „reis“).
 * Akzent-unempfindlich („creme“ = „crème“); Umlaute und ß bleiben eigenständig.
 * - `end`: Wortende einer Zusammensetzung („Vollkornreis“), Mehrzahl erlaubt.
 * - `edge`: zusätzlich Wortanfang („Hähnchenbrust“ für „hähnchen“).
 * Mehrwortige Stichwörter („gehackte tomaten“) gelten als Teilstring des Namens.
 */
export function matchesKeyword(name: string, keyword: string, mode: 'end' | 'edge' = 'end'): boolean {
  return matchesPrepared(prepareName(name), foldAccents(keyword), mode);
}
