import { describe, expect, it } from 'vitest';
import { DiaryEntry } from '../core/models';
import { addDaysISO, toDateISO } from '../core/util/date';
import { formatNum } from '../shared/num.pipe';
import {
  copyFromButtonText,
  copyFromText,
  copySourceOptionText,
  entriesKcal,
  entryCountText,
} from './diary-copy';

function entry(kcal: number): DiaryEntry {
  return {
    id: `e${kcal}`,
    dateISO: '2026-10-12',
    meal: 'breakfast',
    label: 'X',
    ref: { kind: 'manual' },
    facts: { kcal, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion' },
    createdAt: '2026-10-12T07:00:00.000Z',
  };
}

describe('diary-copy helpers', () => {
  const yesterday = addDaysISO(toDateISO(), -1);

  it('nennt gestern relativ und ältere Tage mit Datum', () => {
    expect(copyFromText(yesterday)).toBe('wie gestern');
    expect(copyFromButtonText(yesterday)).toBe('Wie gestern');
    expect(copyFromText('2026-10-13')).toBe('wie am Di., 13.10.');
    expect(copyFromButtonText('2026-10-13')).toBe('Wie am Di., 13.10.');
  });

  it('summiert kcal gerundet und zählt Einträge', () => {
    expect(entriesKcal([entry(100.4), entry(200.4)])).toBe(301);
    expect(entriesKcal([])).toBe(0);
    expect(entryCountText(1)).toBe('1 Eintrag');
    expect(entryCountText(3)).toBe('3 Einträge');
  });

  it('beschreibt eine Quelle für die Tagesauswahl', () => {
    const text = copySourceOptionText({ dateISO: yesterday, entries: [entry(1200), entry(650)] });
    expect(text).toBe(`Gestern · 2 Einträge · ${formatNum(1850, 0)} kcal`);
  });
});
