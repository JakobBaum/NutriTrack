import { describe, expect, it } from 'vitest';
import { UNIT_WEIGHT_G } from '../nutrition/units-weight';
import { UNIT_OPTIONS } from './units';

describe('UNIT_OPTIONS', () => {
  it('enthält jede Einheit der Gewichtstabelle, damit bekannte Einheiten im Select nicht verloren gehen', () => {
    const missing = Object.keys(UNIT_WEIGHT_G).filter((unit) => !UNIT_OPTIONS.includes(unit));
    expect(missing).toEqual([]);
  });

  it('enthält keine Einheit doppelt', () => {
    expect(new Set(UNIT_OPTIONS).size).toBe(UNIT_OPTIONS.length);
  });
});
