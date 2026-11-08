/** Verwirft den Tipptext der genannten Felder (sonst zeigt ein neuer Eintrag z. B. noch "1,"). */
export function clearRawTexts(texts: Record<string, string>, keys: readonly string[]): void {
  keys.forEach((key) => delete texts[key]);
}
