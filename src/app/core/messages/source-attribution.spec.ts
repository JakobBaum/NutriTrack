import { describe, expect, it } from 'vitest';
import { sourceAttribution } from './source-attribution';

describe('sourceAttribution', () => {
  it('nennt Open Food Facts bei Barcode-Treffern', () => {
    expect(sourceAttribution('barcode', false)).toBe('Daten: Open Food Facts (ODbL)');
  });

  it('nennt Open Food Facts bei Suchtreffern', () => {
    expect(sourceAttribution('search', false)).toBe('Daten: Open Food Facts (ODbL)');
  });

  it('ergänzt Open Prices, wenn ein Preis angezeigt wird', () => {
    expect(sourceAttribution('barcode', true)).toBe('Daten: Open Food Facts (ODbL). Preise: Open Prices');
  });

  it('zeigt bei eigenen Etikett-Fotos keine Fremdquelle', () => {
    expect(sourceAttribution('label', false)).toBeNull();
  });
});
