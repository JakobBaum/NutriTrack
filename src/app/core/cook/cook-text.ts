/** Gemeinsame Textnormalisierung des Kochmodus (Zutaten je Schritt, Utensilien). */

/** Kleinschreibung, Umlaute und Akzente gefaltet (ä wird a, ß wird ss). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Zerlegt in Wörter aus Buchstaben (Zahlen und Satzzeichen trennen). */
export function tokenize(value: string): string[] {
  return normalizeText(value).match(/\p{L}+/gu) ?? [];
}
