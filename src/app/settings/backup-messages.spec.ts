import { describe, expect, it } from 'vitest';
import { exportMessage, resetFailure, restoreFailure } from './backup-messages';

describe('Backup-Meldungen (Review 3, Befunde 2, 3, 12)', () => {
  it('resetFailure nennt, dass Daten noch vorhanden sein können', () => {
    const msg = resetFailure();
    expect(msg.header).toBe('Zurücksetzen fehlgeschlagen');
    expect(msg.message).toContain('noch auf diesem Gerät');
  });

  it('restoreFailure erklärt den normalen Fehlschlag mit unveränderten Daten', () => {
    const msg = restoreFailure({ ok: false, safetySaved: false }, 'import');
    expect(msg.header).toBe('Import fehlgeschlagen');
    expect(msg.message).toContain('unverändert');
  });

  it('restoreFailure sagt ehrlich, wenn der vorherige Stand nicht wiederhergestellt werden konnte', () => {
    const msg = restoreFailure({ ok: false, safetySaved: false, rollbackFailed: true }, 'import');
    expect(msg.message).toContain('nicht vollständig wiederhergestellt');
    expect(msg.message).not.toContain('unverändert');
  });

  it('restoreFailure unterscheidet Wiederherstellen der Sicherung vom Import', () => {
    expect(restoreFailure({ ok: false, safetySaved: false }, 'restore').header).toBe('Wiederherstellen fehlgeschlagen');
  });

  it('exportMessage meldet Erfolg nur für geteilt und nicht bestätigt für unverified', () => {
    expect(exportMessage('shared')).toEqual({ kind: 'toast', text: 'Backup erstellt.' });
    expect(exportMessage('downloaded')).toEqual({ kind: 'toast', text: 'Backup heruntergeladen.' });
    expect(exportMessage('cancelled')).toBeNull();
    const unverified = exportMessage('unverified');
    expect(unverified?.kind).toBe('alert');
    expect(JSON.stringify(unverified)).not.toContain('heruntergeladen');
  });
});

describe('Backup-Meldungen: nicht lesbare Bereiche (D11)', () => {
  it('meldet ein unvollständiges Backup mit lesbaren Bereichsnamen statt Schlüsseln', () => {
    const feedback = exportMessage('shared', ['diary', 'week-plan']);
    expect(feedback?.kind).toBe('alert');
    if (feedback?.kind !== 'alert') return;
    expect(feedback.header).toBe('Backup unvollständig');
    expect(feedback.message).toContain('Tagebuch');
    expect(feedback.message).toContain('Wochenplan');
    expect(feedback.message).not.toContain('diary');
    expect(feedback.message).not.toContain('week-plan');
  });

  it('nennt unbekannte Schlüssel nicht roh, sondern als "weitere Daten"', () => {
    const feedback = exportMessage('downloaded', ['geheim-xyz']);
    if (feedback?.kind !== 'alert') throw new Error('Alert erwartet');
    expect(feedback.message).toContain('weitere Daten');
    expect(feedback.message).not.toContain('geheim-xyz');
  });

  it('nennt jeden Bereich nur einmal', () => {
    const feedback = exportMessage('shared', ['weight', 'weightHintDismissedAtKg']);
    if (feedback?.kind !== 'alert') throw new Error('Alert erwartet');
    expect(feedback.message.match(/Gewicht/g)?.length).toBe(1);
  });

  it('abgebrochener Export bleibt still, auch mit übersprungenen Schlüsseln', () => {
    expect(exportMessage('cancelled', ['diary'])).toBeNull();
  });

  it('nicht bestätigter Export bleibt die Fehlermeldung', () => {
    expect(exportMessage('unverified', ['diary'])).toMatchObject({ kind: 'alert', header: 'Backup nicht bestätigt' });
  });
});
