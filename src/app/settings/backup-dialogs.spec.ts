import { describe, expect, it, vi } from 'vitest';
import { BackupCleanup, BackupFile } from '../core/backup/backup';
import { importDialog, resetDialog, safetyDialog } from './backup-dialogs';

const handlers = () => ({ exportFirst: vi.fn(), confirm: vi.fn() });

describe('resetDialog', () => {
  it('nennt durchgehend "zurücksetzen" und sagt, dass eine Sicherung auf dem Gerät bleibt', () => {
    const opts = resetDialog('Letztes Backup: nie', handlers());
    expect(opts.header).toBe('Alle Daten zurücksetzen?');
    expect(opts.message).toContain('Sicherung auf diesem Gerät');
    const texts = (opts.buttons as { text: string }[]).map((b) => b.text);
    expect(texts).toEqual(['Abbrechen', 'Backup zuerst', 'Zurücksetzen']);
    expect(`${opts.header}${opts.message}`).not.toMatch(/löschen\?/);
  });

  it('ruft die Handler der Knöpfe auf', () => {
    const h = handlers();
    const buttons = resetDialog('x', h).buttons as { text: string; handler?: () => void }[];
    buttons.find((b) => b.text === 'Zurücksetzen')?.handler?.();
    buttons.find((b) => b.text === 'Backup zuerst')?.handler?.();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.exportFirst).toHaveBeenCalledTimes(1);
  });
});

describe('importDialog', () => {
  const backup = { exportedAt: '2026-11-01T10:00:00.000Z', data: {} } as unknown as BackupFile;

  it('weist auf übersprungene Einträge hin', () => {
    const opts = importDialog(backup, { skipped: 2 } as BackupCleanup, handlers());
    expect(opts.message).toContain('2 beschädigte Einträge');
    expect(opts.header).toBe('Backup importieren?');
  });
});

describe('safetyDialog', () => {
  it('bietet Wiederherstellen und Löschen der Sicherung an', () => {
    const opts = safetyDialog('Sicherung vom 1.11.', { discard: vi.fn(), restore: vi.fn() });
    const texts = (opts.buttons as { text: string }[]).map((b) => b.text);
    expect(texts).toEqual(['Abbrechen', 'Sicherung löschen', 'Wiederherstellen']);
  });
});
