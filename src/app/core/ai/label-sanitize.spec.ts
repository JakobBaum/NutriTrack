import { describe, expect, it } from 'vitest';
import { LABEL_INVALID_MESSAGE, sanitizeLabelResult } from './label-sanitize';

const facts = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kcal: 380, proteinG: 8, carbsG: 60, fatG: 10, fiberG: 6, sugarG: 20, saltG: 0.5, basis: 'per100g', portionG: null, ...over,
});
const label = (over: Record<string, unknown> = {}, f: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Muesli', facts: facts(f), ...over,
});

describe('sanitizeLabelResult', () => {
  it('uebernimmt plausible Werte je 100 g', () => {
    expect(sanitizeLabelResult(label(), 'per100g')).toEqual({
      name: 'Muesli',
      facts: { kcal: 380, proteinG: 8, carbsG: 60, fatG: 10, fiberG: 6, sugarG: 20, saltG: 0.5, basis: 'per100g' },
    });
  });

  it('setzt die angefragte Basis, nicht die der KI, und verwirft unbekannte Felder', () => {
    const result = sanitizeLabelResult(label({ evil: 1 }, { basis: 'perPortion', extra: 3 }), 'per100g');
    expect(result?.facts.basis).toBe('per100g');
    expect(Object.keys(result?.facts ?? {})).not.toContain('extra');
    expect(Object.keys(result ?? {})).not.toContain('evil');
  });

  it('liefert null bei Nicht-Objekten, fehlenden oder falsch getypten Pflichtwerten', () => {
    for (const raw of [null, 'x', 7, [], {}, { name: 'x' }, label({ facts: 'viel' })]) {
      expect(sanitizeLabelResult(raw, 'per100g')).toBeNull();
    }
    for (const bad of [{ kcal: '380' }, { kcal: NaN }, { proteinG: null }, { carbsG: Infinity }, { fatG: undefined }]) {
      expect(sanitizeLabelResult(label({}, bad), 'per100g')).toBeNull();
    }
  });

  it('liefert null bei unplausiblen Werten je 100 g (isPlausiblePer100g)', () => {
    for (const bad of [{ kcal: 5000 }, { kcal: -1 }, { proteinG: 150 }, { saltG: 101 }, { proteinG: 60, carbsG: 60, fatG: 10 }]) {
      expect(sanitizeLabelResult(label({}, bad), 'per100g')).toBeNull();
    }
  });

  it('laesst unlesbare optionale Werte weg statt sie zu uebernehmen', () => {
    const result = sanitizeLabelResult(label({}, { fiberG: 'viel', sugarG: null, saltG: undefined }), 'per100g');
    expect(result?.facts.fiberG).toBeUndefined();
    expect(result?.facts.sugarG).toBeUndefined();
    expect(result?.facts.saltG).toBeUndefined();
  });

  it('kuerzt und saeubert den Namen; fehlender Name wird zu leerem Text', () => {
    expect(sanitizeLabelResult(label({ name: `  ${'N'.repeat(500)}\n` }), 'per100g')?.name.length).toBeLessThanOrEqual(120);
    expect(sanitizeLabelResult(label({ name: 42 }), 'per100g')?.name).toBe('');
  });

  it('prueft je Portion mit weiteren Grenzen und uebernimmt plausible Portionsgroesse', () => {
    const ok = sanitizeLabelResult(label({}, { kcal: 1200, proteinG: 150, basis: 'perPortion', portionG: 250 }), 'perPortion');
    expect(ok?.facts.basis).toBe('perPortion');
    expect(ok?.facts.portionG).toBe(250);
    expect(sanitizeLabelResult(label({}, { kcal: 90000 }), 'perPortion')).toBeNull();
    expect(sanitizeLabelResult(label({}, { portionG: -5 }), 'perPortion')?.facts.portionG).toBeUndefined();
  });

  it('hat eine verstaendliche Meldung', () => {
    expect(LABEL_INVALID_MESSAGE).toMatch(/Etikett/);
    expect(LABEL_INVALID_MESSAGE).not.toContain('—');
  });
});
