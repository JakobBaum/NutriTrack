import { Intolerance } from '../models';
import { OnlineRecipe } from '../recipes/online/online-recipe.model';
import { INTOLERANCE_RULES, IntoleranceRule } from './intolerance-rules';
import { containsAnyTerm, findSequenceStarts, tokenizeWords } from './word-match';

/** Ersetzt die Wörter aller Ausnahme-Treffer durch '' (treffen danach nichts mehr). */
function maskExceptions(textWords: readonly string[], exceptions: readonly string[]): string[] {
  const masked = [...textWords];
  for (const exception of exceptions) {
    const exceptionWords = tokenizeWords(exception);
    for (const start of findSequenceStarts(textWords, exceptionWords)) {
      exceptionWords.forEach((_, offset) => {
        masked[start + offset] = '';
      });
    }
  }
  return masked;
}

function matchesRule(textWords: readonly string[], rule: IntoleranceRule): boolean {
  if (containsAnyTerm(textWords, rule.safeIf)) return false;
  const words = maskExceptions(textWords, rule.exceptions);
  if (containsAnyTerm(words, rule.words)) return true;
  return words.some((word) => word !== '' && rule.stems.some((stem) => word.includes(stem)));
}

/** Ob `text` (Titel oder Zutatenname) auf eine der Unverträglichkeiten hindeutet; deutsch und englisch. */
export function matchesIntolerance(text: string, intolerances: readonly Intolerance[]): boolean {
  const textWords = tokenizeWords(text);
  if (textWords.length === 0) return false;
  return intolerances.some((i) => matchesRule(textWords, INTOLERANCE_RULES[i]));
}

/** Entfernt Rezepte, deren Titel oder Zutatennamen auf eine Unverträglichkeit hindeuten; ohne Auswahl dieselbe Liste. */
export function filterByIntolerances<T extends Pick<OnlineRecipe, 'title' | 'ingredients'>>(
  recipes: readonly T[],
  intolerances: readonly Intolerance[],
): readonly T[] {
  if (intolerances.length === 0) return recipes;
  return recipes.filter(
    (r) => !matchesIntolerance(r.title, intolerances) && !r.ingredients.some((i) => matchesIntolerance(i.name, intolerances)),
  );
}
