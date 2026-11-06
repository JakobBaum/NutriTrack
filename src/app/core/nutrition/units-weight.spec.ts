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
