/** Gemeinsame Bausteine, um unvertrauenswürdige KI-Antworten zu prüfen (Texte, Zahlen, Listen). */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Text ohne Steuerzeichen, mit einfachen Leerzeichen, getrimmt und gekürzt; null, wenn kein Text. */
export function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

/** True nur für endliche Zahlen im Bereich (Strings, NaN und Infinity zählen nicht). */
export function isInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** Die Zahl, wenn sie im Bereich liegt, sonst undefined. */
export function numberInRange(value: unknown, min: number, max: number): number | undefined {
  return isInRange(value, min, max) ? value : undefined;
}

/** Nur die ersten `max` Einträge einer Liste; Nicht-Listen ergeben eine leere Liste. */
export function boundedList(value: unknown, max: number): readonly unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

/** Rundet auf Cent. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
