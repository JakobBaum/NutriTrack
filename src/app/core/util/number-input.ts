/** Maximale Nachkommastellen bei der Anzeige (verhindert Float-Rauschen wie 0,30000000004). */
const MAX_DISPLAY_DECIMALS = 4;

/** Deutsche Tausender-Schreibweise mit Punkt, z. B. "1.000" oder "12.500.000". */
const THOUSANDS_PATTERN = /^[+-]?[1-9]\d{0,2}(\.\d{3})+$/;

/**
 * Parst eine Zahleneingabe aus einem Textfeld. Akzeptiert Dezimalkomma
 * ("0,5") und Punkt ("1.5") sowie Zahlen; liefert null bei leer/ungültig.
 * "1.000" wird als Tausender gelesen (1000), da deutsche Nutzer so schreiben.
 */
export function parseDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const text = THOUSANDS_PATTERN.test(trimmed)
    ? trimmed.replace(/\./g, '')
    : trimmed.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Formatiert eine Zahl für ein Textfeld mit deutschem Dezimalkomma ("2,5").
 * Liefert '' für null/undefined/ungültig, damit das Feld leer bleibt.
 */
export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const factor = 10 ** MAX_DISPLAY_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded).replace('.', ',');
}

/** Feldfehler für ungültige Zahleneingaben (einheitlich in allen Formularen). */
export const NUMBER_FIELD_ERROR = 'Zahl eingeben, z. B. 12,5';

export interface NutrientInputResult {
  /** Geparster Wert; null bei leerem oder ungültigem Feld. */
  readonly value: number | null;
  /** Fehlertext bei nicht leerer, aber ungültiger (oder negativer) Eingabe, sonst null. */
  readonly error: string | null;
}

/** Prüft ein Zahlenfeld: leer ist erlaubt (kein Fehler), ungültig oder negativ ergibt einen Feldfehler. */
export function parseNutrientInput(text: unknown): NutrientInputResult {
  if (text === null || text === undefined || (typeof text === 'string' && text.trim() === '')) {
    return { value: null, error: null };
  }
  const value = parseDecimal(text);
  if (value === null || value < 0) return { value: null, error: NUMBER_FIELD_ERROR };
  return { value, error: null };
}
