import { describe, expect, it } from 'vitest';
import { NumPipe, formatNum } from './num.pipe';

describe('formatNum', () => {
  it('formats with decimal comma and up to one fraction digit by default', () => {
    expect(formatNum(16.64)).toBe('16,6');
    expect(formatNum(44)).toBe('44');
  });

  it('supports fixed fraction digits for prices', () => {
    expect(formatNum(54.3, 2, 2)).toBe('54,30');
  });

  it('returns a dash for missing values', () => {
    expect(formatNum(undefined)).toBe('–');
    expect(formatNum(Number.NaN)).toBe('–');
  });
});

describe('formatNum — Randfälle', () => {
  it('formatiert 0, negative und große Zahlen', () => {
    expect(formatNum(0)).toBe('0');
    expect(formatNum(-2.25)).toBe('-2,3');
    expect(formatNum(1234567.89)).toMatch(/^1\s234\s567,9$/);
  });

  it('liefert einen Strich für null und Infinity', () => {
    expect(formatNum(null)).toBe('–');
    expect(formatNum(Number.POSITIVE_INFINITY)).toBe('–');
  });

  it('nutzt maxDigits 0 für ganze Zahlen', () => {
    expect(formatNum(2.6, 0)).toBe('3');
  });

  // BUG: Kleine negative Werte runden auf „-0" (Intl signDisplay „auto").
  // num.pipe.ts:20 — Eingabe: -0.04; erwartet: „0", tatsächlich: „-0".
  it('zeigt kein negatives Null', () => {
    expect(formatNum(-0.04)).toBe('0');
  });
});

describe('NumPipe', () => {
  it('delegiert an formatNum', () => {
    expect(new NumPipe().transform(54.3, 2, 2)).toBe('54,30');
    expect(new NumPipe().transform(undefined)).toBe('–');
  });
});
