import { UNIT_OPTIONS } from '../util/units';
import { UNIT_WEIGHT_G, countMissingFacts } from './units-weight';

describe('units-weight', () => {
  it('hat für jede Auswahl-Einheit ein Gewicht', () => {
    for (const u of UNIT_OPTIONS) expect(UNIT_WEIGHT_G[u]).toBeGreaterThan(0);
  });

  it('zählt Zutaten ohne Nährwerte', () => {
    expect(countMissingFacts([{ facts: undefined }, {}])).toBe(2);
    expect(countMissingFacts([])).toBe(0);
  });
});

describe('countMissingFacts — unbekannte Einheit (K8)', () => {
  const per100g = { kcal: 250, proteinG: 4, carbsG: 50, fatG: 3, basis: 'per100g' as const };

  it('zählt eine Zutat mit Werten je 100 g und unbekannter Einheit als fehlend', () => {
    expect(countMissingFacts([{ name: 'Zimt', unit: 'Msp', facts: per100g }])).toBe(1);
  });

  it('zählt bekannte Einheiten nicht als fehlend', () => {
    expect(countMissingFacts([{ name: 'Zimt', unit: 'TL', facts: per100g }])).toBe(0);
    expect(countMissingFacts([{ name: 'Mehl', unit: 'g', facts: per100g }])).toBe(0);
  });

  it('wertet Werte je Portion mit unbekannter Einheit nicht als fehlend (Menge = Anzahl Portionen)', () => {
    expect(countMissingFacts([{ name: 'X', unit: 'Msp', facts: { ...per100g, basis: 'perPortion' } }])).toBe(0);
  });
});
