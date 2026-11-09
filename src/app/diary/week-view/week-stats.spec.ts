import { describe, expect, it } from 'vitest';
import { DayTotals, currentStreak, isDayInGoal, isProteinGoalMet, lastDays, proteinStripStates, weekSummary } from './week-stats';

const target = { kcal: 2000, proteinG: 100 };
const day = (dateISO: string, kcal: number, proteinG: number, logged = true): DayTotals => ({ dateISO, kcal, proteinG, logged });

describe('isDayInGoal', () => {
  it('needs 90 % of the protein target and kcal inside the corridor', () => {
    expect(isDayInGoal(day('2026-11-08', 2000, 90), target)).toBe(true);
    expect(isDayInGoal(day('2026-11-08', 2000, 89), target)).toBe(false);
  });

  it('accepts kcal from 85 % to 105 % of the target', () => {
    expect(isDayInGoal(day('2026-11-08', 1700, 100), target)).toBe(true);
    expect(isDayInGoal(day('2026-11-08', 1699, 100), target)).toBe(false);
    expect(isDayInGoal(day('2026-11-08', 2100, 100), target)).toBe(true);
    expect(isDayInGoal(day('2026-11-08', 2101, 100), target)).toBe(false);
  });

  it('never counts an unlogged day', () => {
    expect(isDayInGoal(day('2026-11-08', 0, 0, false), target)).toBe(false);
  });

  it('is false without a usable target', () => {
    expect(isDayInGoal(day('2026-11-08', 2000, 100), { kcal: 0, proteinG: 0 })).toBe(false);
  });
});

describe('lastDays', () => {
  it('lists n days ending today, oldest first', () => {
    expect(lastDays('2026-11-08', 3)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
  });

  it('crosses month borders', () => {
    expect(lastDays('2026-03-02', 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});

describe('weekSummary', () => {
  it('averages over logged days only and counts days in goal', () => {
    const days = [
      day('2026-11-06', 2000, 100),
      day('2026-11-07', 1000, 50),
      day('2026-11-08', 0, 0, false),
    ];
    const s = weekSummary(days, target);
    expect(s.loggedDays).toBe(2);
    expect(s.avgKcal).toBe(1500);
    expect(s.avgProteinG).toBe(75);
    expect(s.daysInGoal).toBe(1);
  });

  it('returns zeros for an empty week', () => {
    expect(weekSummary([day('2026-11-08', 0, 0, false)], target)).toEqual({ loggedDays: 0, avgKcal: 0, avgProteinG: 0, daysInGoal: 0 });
  });
});

describe('currentStreak', () => {
  const goalDays = new Set(['2026-11-05', '2026-11-06', '2026-11-07']);
  const inGoal = (d: string): boolean => goalDays.has(d);

  it('counts back from yesterday while today is still open', () => {
    expect(currentStreak(inGoal, '2026-11-08')).toBe(3);
  });

  it('includes today when today is in goal', () => {
    expect(currentStreak((d) => inGoal(d) || d === '2026-11-08', '2026-11-08')).toBe(4);
  });

  it('is 0 after a missed day', () => {
    expect(currentStreak(inGoal, '2026-11-10')).toBe(0);
  });

  it('stops at the look-back limit', () => {
    expect(currentStreak(() => true, '2026-11-08', 10)).toBe(10);
  });
});

describe('isProteinGoalMet', () => {
  it('gilt ab 90 % des Eiweißziels, unabhängig von den kcal', () => {
    expect(isProteinGoalMet(day('2026-11-08', 3000, 90), target)).toBe(true);
    expect(isProteinGoalMet(day('2026-11-08', 1500, 89), target)).toBe(false);
  });

  it('zählt Tage ohne Einträge oder ohne Ziel nie', () => {
    expect(isProteinGoalMet(day('2026-11-08', 0, 0, false), target)).toBe(false);
    expect(isProteinGoalMet(day('2026-11-08', 2000, 100), { kcal: 2000, proteinG: 0 })).toBe(false);
  });
});

describe('proteinStripStates', () => {
  it('liefert je Tag den Zustand erreicht, teilweise, offen oder leer und markiert heute', () => {
    const days = [
      day('2026-11-05', 2000, 95),
      day('2026-11-06', 2000, 50),
      day('2026-11-07', 0, 0, false),
      day('2026-11-08', 2000, 20),
    ];
    const states = proteinStripStates(days, target, '2026-11-08');
    expect(states.map((s) => s.state)).toEqual(['met', 'partial', 'empty', 'open']);
    expect(states.map((s) => s.isToday)).toEqual([false, false, false, true]);
  });

  it('hält den Anteil zwischen 0 und 1', () => {
    const [over] = proteinStripStates([day('2026-11-08', 2000, 250)], target, '2026-11-08');
    expect(over.share).toBe(1);
  });
});
