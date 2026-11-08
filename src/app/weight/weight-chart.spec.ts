import { describe, expect, it } from 'vitest';
import { WeightEntry } from '../core/weight/weight-math';
import { buildWeightChart } from './weight-chart';

const e = (dateISO: string, kg: number): WeightEntry => ({ dateISO, kg });
const SIZE = { width: 300, height: 120, padX: 10, padY: 10 };

describe('buildWeightChart', () => {
  it('returns null without entries', () => {
    expect(buildWeightChart([], SIZE)).toBeNull();
  });

  it('places the first point at the left and the last at the right padding', () => {
    const chart = buildWeightChart([e('2026-11-01', 80), e('2026-11-08', 78)], SIZE)!;
    expect(chart.dots[0].x).toBe(10);
    expect(chart.dots[1].x).toBe(290);
  });

  it('draws lower weights lower on screen (larger y)', () => {
    const chart = buildWeightChart([e('2026-11-01', 80), e('2026-11-08', 78)], SIZE)!;
    expect(chart.dots[1].y).toBeGreaterThan(chart.dots[0].y);
  });

  it('keeps all points inside the vertical padding', () => {
    const chart = buildWeightChart([e('2026-11-01', 80), e('2026-11-03', 70), e('2026-11-08', 90)], SIZE)!;
    for (const d of [...chart.dots, ...chart.smoothDots]) {
      expect(d.y).toBeGreaterThanOrEqual(10);
      expect(d.y).toBeLessThanOrEqual(110);
    }
  });

  it('centers a single entry and draws no line', () => {
    const chart = buildWeightChart([e('2026-11-01', 80)], SIZE)!;
    expect(chart.dots[0].x).toBe(150);
    expect(chart.linePath).toBe('');
  });

  it('builds a smoothed line path through all days', () => {
    const chart = buildWeightChart([e('2026-11-01', 80), e('2026-11-02', 79), e('2026-11-03', 78)], SIZE)!;
    expect(chart.linePath.startsWith('M')).toBe(true);
    expect(chart.linePath.match(/L/g)).toHaveLength(2);
  });

  it('labels the range ends in kg', () => {
    const chart = buildWeightChart([e('2026-11-01', 80), e('2026-11-08', 78)], SIZE)!;
    expect(chart.maxLabelKg).toBeGreaterThanOrEqual(80);
    expect(chart.minLabelKg).toBeLessThanOrEqual(78);
  });
});
