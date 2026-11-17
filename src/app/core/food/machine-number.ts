const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Liest eine Zahl aus einer maschinellen Quelle (Open Food Facts, KI-Import). Anders als
 * `parseDecimal` (Nutzereingabe) gibt es hier keine Tausenderpunkt-Heuristik: "1.500" ist 1,5.
 * Ein einzelnes Komma gilt als Dezimaltrenner. Alles andere ergibt null.
 */
export function readMachineNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const normalized = text.includes('.') ? text : text.replace(',', '.');
  if (!PLAIN_NUMBER.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
