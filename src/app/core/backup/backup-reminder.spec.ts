import { describe, expect, it } from 'vitest';
import { REMINDER_NEW_ENTRIES, needsBackupReminder, snoozeUntil } from './backup-reminder';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-09T12:00:00Z');
const daysAgo = (n: number): string => new Date(NOW - n * DAY).toISOString();
const base = { now: NOW, lastBackup: null, entryDates: [] as string[], snoozedUntil: null };

describe('needsBackupReminder', () => {
  it('erinnert nicht, wenn es keine Einträge gibt', () => {
    expect(needsBackupReminder(base)).toBe(false);
  });

  it('erinnert nicht bei frischen Daten ohne bisheriges Backup', () => {
    expect(needsBackupReminder({ ...base, entryDates: [daysAgo(2)] })).toBe(false);
  });

  it('erinnert, wenn der älteste Eintrag 7 Tage alt und nie gesichert wurde', () => {
    expect(needsBackupReminder({ ...base, entryDates: [daysAgo(7), daysAgo(1)] })).toBe(true);
  });

  it('erinnert nicht, wenn seit dem Backup nichts Neues dazukam', () => {
    expect(needsBackupReminder({ ...base, lastBackup: daysAgo(30), entryDates: [daysAgo(40)] })).toBe(false);
  });

  it('erinnert nach 14 Tagen mit neuen Einträgen', () => {
    expect(needsBackupReminder({ ...base, lastBackup: daysAgo(14), entryDates: [daysAgo(3)] })).toBe(true);
  });

  it('erinnert nicht vor 14 Tagen bei wenigen neuen Einträgen', () => {
    expect(needsBackupReminder({ ...base, lastBackup: daysAgo(5), entryDates: [daysAgo(1)] })).toBe(false);
  });

  it('erinnert bei vielen neuen Einträgen auch früher', () => {
    const many = Array.from({ length: REMINDER_NEW_ENTRIES }, () => daysAgo(1));
    expect(needsBackupReminder({ ...base, lastBackup: daysAgo(3), entryDates: many })).toBe(true);
  });

  it('respektiert "Später" bis zum Ablauf', () => {
    const input = { ...base, entryDates: [daysAgo(20)] };
    expect(needsBackupReminder({ ...input, snoozedUntil: new Date(NOW + DAY).toISOString() })).toBe(false);
    expect(needsBackupReminder({ ...input, snoozedUntil: new Date(NOW - DAY).toISOString() })).toBe(true);
  });

  it('ignoriert ungültige Zeitangaben statt abzustürzen', () => {
    expect(needsBackupReminder({ ...base, lastBackup: 'kaputt', entryDates: ['x', daysAgo(10)] })).toBe(true);
    expect(needsBackupReminder({ ...base, entryDates: ['x'] })).toBe(false);
  });
});

describe('snoozeUntil', () => {
  it('liegt 3 Tage in der Zukunft', () => {
    expect(Date.parse(snoozeUntil(NOW)) - NOW).toBe(3 * DAY);
  });
});
