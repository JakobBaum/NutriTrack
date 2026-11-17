import { describe, expect, it } from 'vitest';
import { axisDateLabels, trendText } from './weight-labels';

describe('trendText', () => {
  it('zeigt Vorzeichen und Betrag, runden auf eine Stelle', () => {
    expect(trendText(-0.44)).toBe('−0,4 kg pro Woche');
    expect(trendText(0.26)).toBe('+0,3 kg pro Woche');
  });

  it('zeigt ±0 statt +0,0 oder −0,0, wenn der Wert auf 0 rundet', () => {
    expect(trendText(0.04)).toBe('±0 kg pro Woche');
    expect(trendText(-0.04)).toBe('±0 kg pro Woche');
    expect(trendText(0)).toBe('±0 kg pro Woche');
  });

  it('liefert ohne Trend null', () => {
    expect(trendText(null)).toBeNull();
  });
});

describe('axisDateLabels', () => {
  it('zeigt im selben Jahr nur Tag und Monat', () => {
    expect(axisDateLabels('2026-03-08', '2026-11-08')).toEqual(['08.03.', '08.11.']);
  });

  it('ergänzt das Jahr, wenn der Verlauf Jahre überspannt', () => {
    expect(axisDateLabels('2025-11-08', '2026-02-01')).toEqual(['08.11.2025', '01.02.2026']);
  });

  it('liefert bei leerem Datum leere Texte', () => {
    expect(axisDateLabels('', '')).toEqual(['', '']);
  });
});
