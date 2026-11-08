import { describe, expect, it } from 'vitest';
import { parseNutritionLabel } from './nutrition-label-parser';
import { downscaleFactor } from './label-image';
import { LABEL_FAILED_MESSAGE, LABEL_READ_HINT, blankFieldsFor, evaluateLabelParse } from './label-scan';

describe('evaluateLabelParse', () => {
  it('accepts kcal plus at least two macros', () => {
    const out = evaluateLabelParse(parseNutritionLabel('pro 100 g\nEnergie 380 kcal\nFett 12 g\nKohlenhydrate 55 g'));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.facts.kcal).toBe(380);
      expect(out.facts.proteinG).toBe(0);
      expect(out.missing).toContain('proteinG');
      expect(out.hint.startsWith(LABEL_READ_HINT)).toBe(true);
      expect(out.hint).toContain('Eiweiß');
    }
  });

  it('rejects when kcal is missing', () => {
    const out = evaluateLabelParse(parseNutritionLabel('pro 100 g\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g'));
    expect(out).toEqual({ ok: false, message: LABEL_FAILED_MESSAGE });
  });

  it('rejects when fewer than two macros were read', () => {
    const out = evaluateLabelParse(parseNutritionLabel('pro 100 g\nEnergie 380 kcal\nFett 12 g'));
    expect(out.ok).toBe(false);
  });

  it('uses the plain hint when everything was found', () => {
    const out = evaluateLabelParse(parseNutritionLabel('pro 100 g\nEnergie 380 kcal\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g\nBallaststoffe 3 g\nZucker 4 g'));
    expect(out.ok && out.hint).toBe(LABEL_READ_HINT);
  });

  it('blanks only missing macro fields', () => {
    expect(blankFieldsFor(['proteinG', 'fiberG'])).toEqual({ proteinG: null });
  });
});

describe('downscaleFactor', () => {
  it('shrinks large photos to the max edge', () => {
    expect(downscaleFactor(4000, 3000, 1600)).toBeCloseTo(0.4);
  });
  it('never upscales', () => {
    expect(downscaleFactor(800, 600, 1600)).toBe(1);
  });
  it('is safe for empty sizes', () => {
    expect(downscaleFactor(0, 0)).toBe(1);
  });
});
