import { describe, expect, it } from 'vitest';
import { isMealDraftChanged, isMealDraftDirty, mealSaveBlockReason, rescaleEntryAmount } from './meal-draft';

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

describe('isMealDraftChanged / rescaleEntryAmount', () => {
  const entry = { label: 'Hafer', amountG: 50, facts: { kcal: 200, proteinG: 7 } };
  it('erkennt Änderungen gegenüber dem Ausgangszustand', () => {
    const baseline = { name: 'Brei', entries: [entry] };
    expect(isMealDraftChanged(baseline, 'Brei ', [entry])).toBe(false);
    expect(isMealDraftChanged(baseline, 'Brei', [])).toBe(true);
    expect(isMealDraftChanged(baseline, 'Haferbrei', [entry])).toBe(true);
  });
  it('skaliert Nährwerte proportional zur neuen Menge', () => {
    const scaled = rescaleEntryAmount(entry, 100);
    expect(scaled.amountG).toBe(100);
    expect(scaled.facts.kcal).toBe(400);
    expect(rescaleEntryAmount(entry, 0)).toBe(entry);
  });
});
