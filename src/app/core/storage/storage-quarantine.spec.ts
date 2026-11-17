import { describe, expect, it } from 'vitest';
import {
  MAX_QUARANTINE_CHARS,
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

describe('D10 Größengrenze', () => {
  const NOW = new Date('2026-01-01T00:00:00Z');

  it('kürzt zu langen Rohtext und markiert ihn', () => {
    const rec = buildQuarantineRecord('diary', 'parse', { raw: 'x'.repeat(MAX_QUARANTINE_CHARS + 500) }, NOW);
    expect(rec.raw?.length).toBe(MAX_QUARANTINE_CHARS);
    expect(rec.truncated).toBe(true);
  });

  it('lässt kurzen Rohtext unverändert', () => {
    const rec = buildQuarantineRecord('diary', 'parse', { raw: 'abc' }, NOW);
    expect(rec.raw).toBe('abc');
    expect(rec.truncated).toBeUndefined();
  });

  it('ersetzt übergroße Datensätze durch eine gekürzte Vorschau', () => {
    const big = { text: 'y'.repeat(MAX_QUARANTINE_CHARS * 2) };
    const rec = buildQuarantineRecord('diary', 'invalid', { items: [{ a: 1 }, big] }, NOW);
    expect(rec.items?.[0]).toEqual({ a: 1 });
    expect(typeof rec.items?.[1]).toBe('string');
    expect((rec.items?.[1] as string).length).toBeLessThanOrEqual(MAX_QUARANTINE_CHARS);
    expect(rec.truncated).toBe(true);
  });
});
