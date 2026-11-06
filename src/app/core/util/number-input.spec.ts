import { describe, expect, it } from 'vitest';
import { formatDecimal, parseDecimal } from './number-input';

describe('parseDecimal', () => {
  it('parses a German decimal comma', () => {
    expect(parseDecimal('0,5')).toBe(0.5);
  });

  it('parses a decimal point and trims whitespace', () => {
    expect(parseDecimal(' 1.5 ')).toBe(1.5);
  });

  it('passes finite numbers through', () => {
    expect(parseDecimal(2)).toBe(2);
  });

  it('returns null for empty, invalid or non-finite input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
    expect(parseDecimal(NaN)).toBeNull();
  });

  it('liest deutsche Tausenderpunkte als Tausender', () => {
    expect(parseDecimal('1.000')).toBe(1000);
    expect(parseDecimal('12.500')).toBe(12500);
    expect(parseDecimal('1.000.000')).toBe(1000000);
  });

  it('bleibt bei Dezimalpunkt ohne Dreiergruppe bei Dezimal', () => {
    expect(parseDecimal('1.5')).toBe(1.5);
    expect(parseDecimal('1.25')).toBe(1.25);
    expect(parseDecimal('1.0001')).toBe(1.0001);
  });

  it('liefert null für Whitespace (Tab/Zeilenumbruch)', () => {
    expect(parseDecimal('\t\n ')).toBeNull();
  });
});

describe('formatDecimal', () => {
  it('formatiert mit deutschem Dezimalkomma', () => {
    expect(formatDecimal(2.5)).toBe('2,5');
    expect(formatDecimal(0.5)).toBe('0,5');
  });

  it('lässt ganze Zahlen ohne Komma', () => {
    expect(formatDecimal(4)).toBe('4');
    expect(formatDecimal(0)).toBe('0');
  });

  it('liefert leeren String für null/undefined/NaN', () => {
    expect(formatDecimal(null)).toBe('');
    expect(formatDecimal(undefined)).toBe('');
    expect(formatDecimal(NaN)).toBe('');
  });

  it('entfernt Float-Rauschen', () => {
    expect(formatDecimal(0.1 + 0.2)).toBe('0,3');
  });

  it('ist mit parseDecimal umkehrbar', () => {
    expect(parseDecimal(formatDecimal(2.5))).toBe(2.5);
    expect(parseDecimal(formatDecimal(1000))).toBe(1000);
  });
});
