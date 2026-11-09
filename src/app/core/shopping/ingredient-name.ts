/** Namensnormalisierung für das Zusammenfassen gleicher Zutaten (Groß/Klein, Singular/Plural, Klammern). */

/** Häufige Plurale -> Singular (klein). Mengen-Wörter (Erbsen, Linsen, Nudeln) bleiben bewusst unberührt. */
const SINGULAR: Readonly<Record<string, string>> = {
  zwiebeln: 'zwiebel', tomaten: 'tomate', kartoffeln: 'kartoffel', karotten: 'karotte', möhren: 'möhre',
  eier: 'ei', zitronen: 'zitrone', limetten: 'limette', äpfel: 'apfel', bananen: 'banane', orangen: 'orange',
  paprikas: 'paprika', gurken: 'gurke', zucchinis: 'zucchini', champignons: 'champignon', pilze: 'pilz',
  knoblauchzehen: 'knoblauchzehe', schalotten: 'schalotte', avocados: 'avocado', birnen: 'birne',
  süßkartoffeln: 'süßkartoffel', frühlingszwiebeln: 'frühlingszwiebel', garnelen: 'garnele', mandeln: 'mandel',
  walnüsse: 'walnuss', erdnüsse: 'erdnuss', tortillas: 'tortilla', brötchen: 'brötchen', lorbeerblätter: 'lorbeerblatt',
  chilis: 'chili', chilischoten: 'chilischote', datteln: 'dattel', feigen: 'feige', pflaumen: 'pflaume',
};

/** Entfernt Klammerzusätze, mehrfache Leerzeichen und Rand-Satzzeichen. */
export function cleanName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, '');
}

function singularWord(word: string): string {
  return SINGULAR[word] ?? word;
}

/** Vergleichsschlüssel einer Zutat: klein, ohne Klammern, jedes Wort im Singular. */
export function nameKey(name: string): string {
  return cleanName(name)
    .toLowerCase()
    .split(/(\s+|,)/)
    .map(singularWord)
    .join('')
    .replace(/\s*,\s*/g, ', ');
}

/** Erster Buchstabe groß („zwiebel“ -> „Zwiebel“), Rest unverändert. */
export function displayName(name: string): string {
  const cleaned = cleanName(name);
  const singular = SINGULAR[cleaned.toLowerCase()];
  const text = singular ?? cleaned;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
