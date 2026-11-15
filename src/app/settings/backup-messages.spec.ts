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
