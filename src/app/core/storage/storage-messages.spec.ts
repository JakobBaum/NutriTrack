import { describe, expect, it } from 'vitest';
import { SCHEMA_NEWER_MESSAGE, describeStorageError } from './storage-messages';

describe('describeStorageError', () => {
  const err = (kind: 'quota' | 'unavailable' | 'unknown') => ({ kind, keys: ['diary'], at: 0 });

  it('nennt bei vollem Speicher Ursache, Folge und Backup-Export', () => {
    const text = describeStorageError(err('quota'));
    expect(text).toContain('Gerätespeicher ist voll');
    expect(text).toContain('noch nicht gesichert');
    expect(text).toContain('Backup');
  });

  it('nennt bei gesperrtem Speicher, dass nichts dauerhaft bleibt', () => {
    expect(describeStorageError(err('unavailable'))).toContain('nicht dauerhaft');
  });

  it('hat für unbekannte Fehler eine klare Meldung mit Backup-Hinweis', () => {
    const text = describeStorageError(err('unknown'));
    expect(text).toContain('Speichern fehlgeschlagen');
    expect(text).toContain('Backup');
  });

  it('enthält keine Emojis und keine Rohfehler', () => {
    ['quota', 'unavailable', 'unknown'].forEach((k) => {
      expect(describeStorageError(err(k as never))).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]|Error|Exception/u);
    });
    expect(SCHEMA_NEWER_MESSAGE).toContain('neueren');
  });
});
