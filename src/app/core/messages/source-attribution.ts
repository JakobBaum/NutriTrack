/** Quellenangaben, die neben Open-Food-Facts-Daten und Open-Prices-Preisen sichtbar sind. */
export const OFF_ATTRIBUTION = 'Daten: Open Food Facts (ODbL)';
export const PRICES_ATTRIBUTION = 'Preise: Open Prices';

/** Quellenzeile zu einem Treffer; Etiketten (eigene Fotos) haben keine Fremdquelle. */
export function sourceAttribution(source: 'search' | 'barcode' | 'label', hasPrice: boolean): string | null {
  if (source === 'label') return null;
  return hasPrice ? `${OFF_ATTRIBUTION}. ${PRICES_ATTRIBUTION}` : OFF_ATTRIBUTION;
}
