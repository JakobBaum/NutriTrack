import type { ExportResult, RestoreResult } from '../core/backup/backup.service';

/** Titel und Text eines Fehlerdialogs. */
export interface ErrorMessage {
  readonly header: string;
  readonly message: string;
}

/** Rückmeldung nach dem Export: kurzer Hinweis (Toast), Dialog oder nichts (abgebrochen). */
export type ExportFeedback =
  | { readonly kind: 'toast'; readonly text: string }
  | { readonly kind: 'alert'; readonly header: string; readonly message: string };

/** Zurücksetzen konnte nicht alle Daten löschen. */
export function resetFailure(): ErrorMessage {
  return {
    header: 'Zurücksetzen fehlgeschlagen',
    message:
      'Nicht alle Daten konnten gelöscht werden. Einige Daten liegen eventuell noch auf diesem Gerät. Bitte starte die App neu und versuche es erneut.',
  };
}

const RESTORE_COPY = {
  import: { header: 'Import fehlgeschlagen', subject: 'Der Import ist', current: 'bisherigen' },
  restore: { header: 'Wiederherstellen fehlgeschlagen', subject: 'Die Sicherung konnte nicht eingespielt werden', current: 'aktuellen' },
} as const;

/** Fehlertext für einen gescheiterten Import oder eine gescheiterte Wiederherstellung (ehrlich auch bei gescheitertem Rückrollen). */
export function restoreFailure(result: RestoreResult, source: keyof typeof RESTORE_COPY): ErrorMessage {
  const copy = RESTORE_COPY[source];
  if (result.rollbackFailed) {
    return {
      header: copy.header,
      message: `${copy.header}, der vorherige Stand konnte nicht vollständig wiederhergestellt werden. Einige Daten fehlen eventuell. Bitte versuche es erneut, bevor du die App weiter nutzt.`,
    };
  }
  const reason = source === 'import' ? `${copy.subject} fehlgeschlagen` : copy.subject;
  return {
    header: copy.header,
    message: `${reason} (Speicher voll oder gesperrt). Deine ${copy.current} Daten sind unverändert.`,
  };
}

/** Rückmeldung zum Export; `null`, wenn der Nutzer abgebrochen hat. */
export function exportMessage(result: ExportResult): ExportFeedback | null {
  if (result === 'shared') return { kind: 'toast', text: 'Backup erstellt.' };
  if (result === 'downloaded') return { kind: 'toast', text: 'Backup heruntergeladen.' };
  if (result === 'unverified') {
    return {
      kind: 'alert',
      header: 'Backup nicht bestätigt',
      message:
        'Das Teilen-Menü war auf diesem Gerät nicht verfügbar. Ob die Datei gespeichert wurde, lässt sich nicht prüfen. Bitte versuche es erneut.',
    };
  }
  return null;
}
