import { describe, expect, it } from 'vitest';
import {
  QuarantineNotice,
  buildQuarantineRecord,
  describeNotices,
  isQuarantineKey,
  keysToPrune,
  quarantineKey,
} from './storage-quarantine';

describe('storage-quarantine', () => {
  it('erkennt Quarantäne-Schlüssel', () => {
    expect(isQuarantineKey(quarantineKey('diary', 5))).toBe(true);
    expect(isQuarantineKey('diary')).toBe(false);
  });

  it('behält die neuesten Einträge und nennt die ältesten zum Entfernen', () => {
    const keys = [1, 5, 3, 9, 7].map((t) => quarantineKey('diary', t));
    expect(keysToPrune(keys, 3)).toEqual([quarantineKey('diary', 3), quarantineKey('diary', 1)]);
    expect(keysToPrune(keys, 10)).toEqual([]);
  });

  it('ignoriert fremde Schlüssel beim Aufräumen', () => {
    expect(keysToPrune(['diary', quarantineKey('x', 1)], 0)).toEqual([quarantineKey('x', 1)]);
  });

  it('baut den Eintrag mit Zeitpunkt', () => {
    const r = buildQuarantineRecord('diary', 'invalid', { items: [1] }, new Date('2026-11-09T10:00:00Z'));
    expect(r).toEqual({ key: 'diary', reason: 'invalid', at: '2026-11-09T10:00:00.000Z', items: [1] });
  });

  it('beschreibt Hinweise in Einzahl und Mehrzahl', () => {
    const n = (count: number, saved = true): QuarantineNotice => ({ key: 'diary', count, saved });
    expect(describeNotices([])).toBe('');
    expect(describeNotices([n(1)])).toBe('1 beschädigter Datensatz wurde aussortiert und gesichert.');
    expect(describeNotices([n(2), n(1)])).toBe('3 beschädigte Datensätze wurden aussortiert und gesichert.');
    expect(describeNotices([n(2, false)])).toBe('2 beschädigte Datensätze wurden aussortiert.');
  });
});
