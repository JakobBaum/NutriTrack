import { DiaryEntry } from '../core/models';
import { amountChips, editModeFor, mealShortLabel, stepAmount, stepServings, withServings } from './diary-edit';

const FACTS = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 4, basis: 'perPortion' as const };
const entry = (over: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e1', dateISO: '2026-01-01', meal: 'lunch', label: 'Suppe', ref: { kind: 'manual' },
  facts: FACTS, createdAt: '2026-01-01T10:00:00Z', ...over,
});

describe('stepAmount', () => {
  it('steps g/ml by 10', () => {
    expect(stepAmount(100, 'g', 1)).toBe(110);
    expect(stepAmount(100, 'ml', -1)).toBe(90);
  });
  it('steps kg/l by 0.05 without float drift', () => {
    expect(stepAmount(0.1, 'kg', 1)).toBe(0.15);
    expect(stepAmount(0.3, 'l', 1)).toBe(0.35);
  });
  it('never goes below one step and treats empty as 0', () => {
    expect(stepAmount(10, 'g', -1)).toBe(10);
    expect(stepAmount(null, 'g', 1)).toBe(10);
    expect(stepAmount(null, 'g', -1)).toBe(10);
  });
});

describe('stepServings', () => {
  it('steps by 0.5 with minimum 0.5', () => {
    expect(stepServings(1, 1)).toBe(1.5);
    expect(stepServings(0.5, -1)).toBe(0.5);
    expect(stepServings(null, 1)).toBe(0.5);
  });
});

describe('amountChips', () => {
  it('returns presets when last is missing or already a preset', () => {
    expect(amountChips('g', null).map((c) => c.value)).toEqual([50, 100, 150, 200]);
    expect(amountChips('g', 100).some((c) => c.isLast)).toBe(false);
  });
  it('replaces the largest preset by a differing last amount (max 4 chips)', () => {
    const chips = amountChips('g', 120);
    expect(chips.map((c) => c.value)).toEqual([50, 100, 150, 120]);
    expect(chips[3].isLast).toBe(true);
  });
});

describe('amountChips mit Portionsgröße', () => {
  it('stellt die Packungsportion an die erste Stelle und bleibt bei vier Chips', () => {
    const chips = amountChips('g', null, 35);
    expect(chips.map((c) => c.value)).toEqual([35, 50, 100, 150]);
    expect(chips[0].isServing).toBe(true);
  });
  it('lässt die Portion weg, wenn sie schon eine Vorgabe ist', () => {
    expect(amountChips('g', null, 100).map((c) => c.value)).toEqual([50, 100, 150, 200]);
  });
  it('zeigt Portion und zuletzt gemeinsam, ohne vier Chips zu überschreiten', () => {
    const chips = amountChips('g', 120, 35);
    expect(chips.map((c) => c.value)).toEqual([35, 50, 100, 120]);
    expect(chips.length).toBe(4);
  });
  it('ignoriert die Portion bei kg und l', () => {
    expect(amountChips('kg', null, 35).map((c) => c.value)).toEqual([0.1, 0.25, 0.5, 1]);
  });
});

describe('editModeFor / withServings / mealShortLabel', () => {
  it('detects the edit mode', () => {
    expect(editModeFor(entry(), FACTS)).toBe('amount');
    expect(editModeFor(entry({ servings: 2 }), null)).toBe('portion');
    expect(editModeFor(entry(), null)).toBe('optional');
  });
  it('rescales facts from per-serving values', () => {
    const next = withServings(entry({ servings: 2, facts: { ...FACTS, kcal: 400 } }), 3);
    expect(next.servings).toBe(3);
    expect(next.facts.kcal).toBe(600);
  });
  it('has short labels', () => {
    expect(mealShortLabel('breakfast')).toBe('Früh');
  });
});
