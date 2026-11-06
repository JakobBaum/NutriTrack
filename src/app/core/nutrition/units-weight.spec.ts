import { UNIT_OPTIONS } from '../util/units';
import { UNIT_WEIGHT_G, countMissingFacts } from './units-weight';

describe('units-weight', () => {
  it('hat für jede Auswahl-Einheit ein Gewicht und umgekehrt', () => {
    expect([...UNIT_OPTIONS].sort()).toEqual(Object.keys(UNIT_WEIGHT_G).sort());
  });

  it('zählt Zutaten ohne Nährwerte', () => {
    expect(countMissingFacts([{ facts: undefined }, {}])).toBe(2);
    expect(countMissingFacts([])).toBe(0);
  });
});
