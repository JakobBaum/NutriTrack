import { describe, expect, it } from 'vitest';
import { isMealDraftDirty, mealSaveBlockReason } from './meal-draft';

describe('mealSaveBlockReason', () => {
  it('nennt den fehlenden Namen zuerst', () => {
    expect(mealSaveBlockReason('  ', 0)).toMatch(/Namen/);
  });
  it('nennt fehlende Einträge, wenn der Name da ist', () => {
    expect(mealSaveBlockReason('Frühstück', 0)).toMatch(/mindestens ein/i);
  });
  it('ist leer, wenn alles passt', () => {
    expect(mealSaveBlockReason('Frühstück', 1)).toBe('');
  });
});

describe('isMealDraftDirty', () => {
  it('ist false bei leerem Entwurf', () => {
    expect(isMealDraftDirty(' ', 0)).toBe(false);
  });
  it('ist true bei Name oder Einträgen', () => {
    expect(isMealDraftDirty('x', 0)).toBe(true);
    expect(isMealDraftDirty('', 2)).toBe(true);
  });
});
