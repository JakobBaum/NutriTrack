import { describe, expect, it } from 'vitest';
import { readMachineNumber } from './machine-number';

describe('readMachineNumber (K15)', () => {
  it('liest Zahlen und Zahltexte mit Punkt als Dezimaltrenner', () => {
    expect(readMachineNumber(12.5)).toBe(12.5);
    expect(readMachineNumber('12.5')).toBe(12.5);
    expect(readMachineNumber(' 7 ')).toBe(7);
  });

  it('wertet "1.500" nicht als Tausenderpunkt (maschinelle Quellen kennen keinen)', () => {
    expect(readMachineNumber('1.500')).toBe(1.5);
    expect(readMachineNumber('1.250')).toBe(1.25);
  });

  it('nimmt ein einzelnes Komma als Dezimaltrenner', () => {
    expect(readMachineNumber('1,5')).toBe(1.5);
  });

  it('liefert null für Unsinn, NaN, Infinity und Leeres', () => {
    for (const bad of [null, undefined, '', 'viel', 'NaN', NaN, Infinity, '1.2.3', '1e3x', {}, []]) {
      expect(readMachineNumber(bad)).toBeNull();
    }
  });
});
