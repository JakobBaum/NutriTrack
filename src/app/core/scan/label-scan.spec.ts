import { describe, expect, it } from 'vitest';
import { parseNutritionLabel } from './nutrition-label-parser';
import { downscaleFactor, shrinkPhotoForUpload, type PhotoShrinkDeps } from './label-image';
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

describe('shrinkPhotoForUpload', () => {
  function deps(width: number, height: number): { deps: PhotoShrinkDeps; canvas: { width: number; height: number; toDataURL: () => string } } {
    const canvas = { width: 0, height: 0, toDataURL: () => 'data:image/jpeg;base64,SMALL' };
    return {
      canvas,
      deps: {
        load: async () => ({ width, height, draw: () => undefined }),
        createCanvas: () => canvas as unknown as HTMLCanvasElement,
      },
    };
  }

  it('returns photos within the limit unchanged', async () => {
    const { deps: d } = deps(1200, 900);
    expect(await shrinkPhotoForUpload('ORIGINAL', 1600, d)).toBe('ORIGINAL');
  });

  it('scales large photos to the max edge and returns the re-encoded JPEG', async () => {
    const { deps: d, canvas } = deps(4000, 3000);
    expect(await shrinkPhotoForUpload('ORIGINAL', 1600, d)).toBe('SMALL');
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
  });

  it('falls back to the original when the image cannot be processed', async () => {
    const failing: PhotoShrinkDeps = { load: async () => { throw new Error('bad'); }, createCanvas: () => document.createElement('canvas') };
    expect(await shrinkPhotoForUpload('ORIGINAL', 1600, failing)).toBe('ORIGINAL');
  });
});
