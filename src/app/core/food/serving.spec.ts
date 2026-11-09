import { describe, expect, it } from 'vitest';
import { MAX_SERVING_G, MIN_SERVING_G, plausibleServingG } from './serving';

/** Werte, wie sie Open Food Facts in `serving_quantity` liefert (Zahl oder Text, teils unbrauchbar). */
const RECORDED: ReadonlyArray<readonly [unknown, number | undefined]> = [
  ['30', 30], // Müsliriegel
  [250, 250], // Joghurtbecher
  ['33.5', 33.5], // Dezimalpunkt
  ['12,5', 12.5], // Dezimalkomma
  [1, 1],
  [1000, 1000],
  ['0.2', undefined], // Gewürz, Tippfehler "0.2 g"
  [0, undefined],
  [-30, undefined],
  ['1500', undefined], // Packungsgröße statt Portion
  ['100000', undefined],
  ['', undefined],
  ['ca. 40', undefined],
  [null, undefined],
  [undefined, undefined],
  [Number.NaN, undefined],
];

describe('plausibleServingG', () => {
  it.each(RECORDED)('wertet %j als %j', (raw, expected) => {
    expect(plausibleServingG(raw)).toBe(expected);
  });

  it('nennt die Grenzen als Konstanten', () => {
    expect(MIN_SERVING_G).toBe(1);
    expect(MAX_SERVING_G).toBe(1000);
  });
});
