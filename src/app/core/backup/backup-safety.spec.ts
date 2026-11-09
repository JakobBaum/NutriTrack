import { describe, expect, it } from 'vitest';
import { buildSafetySnapshot, describeSafetySnapshot, hasBackupContent, readSafetySnapshot } from './backup-safety';

const facts = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' };
const entry = { id: 'd1', dateISO: '2026-11-08', meal: 'lunch', label: 'Reis', ref: { kind: 'manual' }, facts, createdAt: '2026-11-08T10:00:00.000Z' };
const NOW = new Date('2026-11-09T10:00:00.000Z');

describe('hasBackupContent', () => {
  it.each([
    [{}, false],
    [{ diary: [], profile: null, shopping: null, recipes: [] }, false],
    [{ diary: [entry] }, true],
    [{ profile: { weightKg: 80 } }, true],
    [{ lastBackup: '2026-11-01T00:00:00.000Z', schemaVersion: 1 }, false],
  ])('%j -> %s', (data, expected) => {
    expect(hasBackupContent(data)).toBe(expected);
  });
});

describe('buildSafetySnapshot', () => {
  it('liefert null, wenn es nichts zu sichern gibt', () => {
    expect(buildSafetySnapshot({ diary: [] }, 'reset', NOW)).toBeNull();
  });

  it('enthält Grund, Zeitpunkt und ein reguläres Backup ohne Geräte-Schlüssel', () => {
    const s = buildSafetySnapshot({ diary: [entry], schemaVersion: 1, autosnapshot: { alt: true } }, 'import', NOW);
    expect(s?.reason).toBe('import');
    expect(s?.at).toBe(NOW.toISOString());
    expect(s?.backup.format).toBe('nutritrack-backup');
    expect(Object.keys(s?.backup.data ?? {})).toEqual(['diary']);
  });
});

describe('readSafetySnapshot', () => {
  const valid = buildSafetySnapshot({ diary: [entry] }, 'reset', NOW);

  it('liest eine gültige Sicherung', () => {
    expect(readSafetySnapshot(JSON.parse(JSON.stringify(valid)))?.reason).toBe('reset');
  });

  it.each([null, undefined, 'x', 5, {}, { at: 'x', reason: 'reset', backup: {} }, { ...valid, reason: 'bogus' }, { ...valid, backup: { format: 'x' } }])(
    'liefert null für Ungültiges (%#)',
    (raw) => {
      expect(readSafetySnapshot(raw)).toBeNull();
    },
  );
});

describe('describeSafetySnapshot', () => {
  it('nennt Zeitpunkt, Anlass und Inhalt', () => {
    const s = buildSafetySnapshot({ diary: [entry] }, 'reset', NOW);
    const text = describeSafetySnapshot(s!);
    expect(text).toContain('vor dem Zurücksetzen');
    expect(text).toContain('1 Tagebucheintrag');
  });
});
