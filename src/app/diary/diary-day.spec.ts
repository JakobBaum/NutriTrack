import { parseDiaryQuery, summarizeDay } from './diary-day';

function params(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe('summarizeDay', () => {
  it('rundet Summen und berechnet Rest ohne Ueberschreitung', () => {
    const s = summarizeDay({ kcal: 1234.6, proteinG: 80.4 }, { kcal: 2000, proteinG: 120 });
    expect(s.totalKcal).toBe(1235);
    expect(s.totalProtein).toBe(80);
    expect(s.remainingKcal).toBe(765);
    expect(s.remainingProtein).toBe(40);
    expect(s.overKcal).toBe(0);
  });

  it('meldet Ueberschreitung und Rest 0, wenn das Ziel ueberschritten ist', () => {
    const s = summarizeDay({ kcal: 2300, proteinG: 130 }, { kcal: 2000, proteinG: 120 });
    expect(s.remainingKcal).toBe(0);
    expect(s.remainingProtein).toBe(0);
    expect(s.overKcal).toBe(300);
  });

  it('ohne Ziel gibt es weder Rest noch Ueberschreitung', () => {
    const s = summarizeDay({ kcal: 500, proteinG: 20 }, null);
    expect(s.targetKcal).toBe(0);
    expect(s.remainingKcal).toBe(0);
    expect(s.overKcal).toBe(0);
  });
});

describe('parseDiaryQuery', () => {
  it('erkennt leere Query', () => {
    const q = parseDiaryQuery(params({}));
    expect(q.hasAny).toBe(false);
    expect(q.date).toBeNull();
  });

  it('liest add mit gueltiger Essenszeit', () => {
    const q = parseDiaryQuery(params({ add: 'lunch' }));
    expect(q.wantsAdd).toBe(true);
    expect(q.addMeal).toBe('lunch');
    expect(q.hasAny).toBe(true);
  });

  it('add mit ungueltiger Essenszeit oeffnet trotzdem, ohne feste Essenszeit', () => {
    const q = parseDiaryQuery(params({ add: 'brunch' }));
    expect(q.wantsAdd).toBe(true);
    expect(q.addMeal).toBeNull();
  });

  it('verwirft ungueltiges Datum, behaelt gueltiges', () => {
    expect(parseDiaryQuery(params({ date: 'gestern' })).date).toBeNull();
    expect(parseDiaryQuery(params({ date: '2026-11-09' })).date).toBe('2026-11-09');
  });

  it('erkennt fastfood nur bei 1 und meal als Scroll-Ziel', () => {
    expect(parseDiaryQuery(params({ fastfood: '1' })).wantsFastfood).toBe(true);
    expect(parseDiaryQuery(params({ fastfood: 'ja' })).wantsFastfood).toBe(false);
    expect(parseDiaryQuery(params({ meal: 'dinner' })).scrollMeal).toBe('dinner');
  });
});
