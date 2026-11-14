/** Ab dieser Länge darf ein Begriff mit einfacher Beugungsendung treffen (kurze wie "ei" nur exakt oder mit Sonderendungen). */
const MIN_STEM_LENGTH = 3;
/** Endungen für Mehrzahl und einfache Beugung (Zwiebel/Zwiebeln, Pilz/Pilze, egg/eggs, tomato/tomatoes). */
const INFLECTION_SUFFIXES: readonly string[] = ['s', 'n', 'e', 'en', 'er', 'es'];
/** Kurze Begriffe, die trotzdem bestimmte Endungen zulassen (Ei/Eier/Eiern, aber nicht Eis oder einrühren). */
const SHORT_TERM_SUFFIXES: Readonly<Record<string, readonly string[]>> = { ei: ['er', 'ern'] };
const NON_LETTERS = /[^\p{L}]+/u;

/** Zerlegt Text in kleingeschriebene Wörter (Buchstaben inkl. Umlaute); alles andere trennt. */
export function tokenizeWords(text: string): string[] {
  return text.toLowerCase().split(NON_LETTERS).filter((w) => w !== '');
}

function isYPlural(word: string, termWord: string): boolean {
  return termWord.endsWith('y') && word === `${termWord.slice(0, -1)}ies`;
}

/** Ob `word` dem Begriffswort entspricht: exakt, mit einfacher Beugung (ab drei Zeichen) oder y/ies (berry/berries). */
export function wordMatchesTerm(word: string, termWord: string): boolean {
  if (word === termWord) return true;
  const shortSuffixes = SHORT_TERM_SUFFIXES[termWord];
  if (shortSuffixes) return word.startsWith(termWord) && shortSuffixes.includes(word.slice(termWord.length));
  if (termWord.length < MIN_STEM_LENGTH) return false;
  if (isYPlural(word, termWord)) return true;
  return word.startsWith(termWord) && INFLECTION_SUFFIXES.includes(word.slice(termWord.length));
}

/** Startpositionen, an denen die Begriffswörter als zusammenhängende Folge in den Textwörtern stehen. */
export function findSequenceStarts(textWords: readonly string[], termWords: readonly string[]): number[] {
  const starts: number[] = [];
  if (termWords.length === 0) return starts;
  for (let start = 0; start <= textWords.length - termWords.length; start++) {
    if (termWords.every((tw, offset) => wordMatchesTerm(textWords[start + offset], tw))) starts.push(start);
  }
  return starts;
}

/** Ob einer der Begriffe als ganzes Wort bzw. zusammenhängende Wortfolge im Text steht. */
export function containsAnyTerm(textWords: readonly string[], terms: readonly string[]): boolean {
  return terms.some((term) => findSequenceStarts(textWords, tokenizeWords(term)).length > 0);
}
