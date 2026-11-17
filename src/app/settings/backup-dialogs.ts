import { AlertButton, AlertController, AlertOptions } from '@ionic/angular';
import { BackupCleanup, BackupFile, countBackup, describeCounts, formatBackupDate } from '../core/backup/backup';

/** Handler der Knöpfe im Zurücksetzen- und Import-Dialog. */
export interface ConfirmHandlers {
  /** „Backup zuerst“: erst sichern, danach den Dialog erneut zeigen. */
  readonly exportFirst: () => void;
  /** Bestätigen (Zurücksetzen bzw. Ersetzen). */
  readonly confirm: () => void;
}

const CANCEL: AlertButton = { text: 'Abbrechen', role: 'cancel' };

/** Dialog „Alle Daten zurücksetzen?“ mit Hinweis auf die automatische Sicherung. */
export function resetDialog(lastBackupLabel: string, h: ConfirmHandlers): AlertOptions {
  return {
    header: 'Alle Daten zurücksetzen?',
    message:
      `Profil, Tagebuch, Gewichtsverlauf, Favoriten, Rezepte, gespeicherte Mahlzeiten, eigene Lebensmittel, Einkaufsliste und Einstellungen werden von diesem Gerät entfernt. ${lastBackupLabel}. Zur Sicherheit bleibt eine automatische Sicherung auf diesem Gerät, bis du sie unter Daten löschst.`,
    buttons: [
      CANCEL,
      { text: 'Backup zuerst', handler: h.exportFirst },
      { text: 'Zurücksetzen', role: 'destructive', handler: h.confirm },
    ],
  };
}

/** Dialog „Backup importieren?“ mit Datum, Mengen und übersprungenen Einträgen. */
export function importDialog(backup: BackupFile, cleanup: BackupCleanup, h: ConfirmHandlers): AlertOptions {
  const date = formatBackupDate(backup.exportedAt) ?? 'unbekannt';
  const skipped = cleanup.skipped > 0 ? ` ${cleanup.skipped} beschädigte Einträge werden übersprungen und gesichert.` : '';
  return {
    header: 'Backup importieren?',
    message: `Backup vom ${date}: ${describeCounts(countBackup(backup.data))}. Alle aktuellen Daten auf diesem Gerät werden dadurch ersetzt. Der aktuelle Stand wird vorher automatisch gesichert.${skipped}`,
    buttons: [
      CANCEL,
      { text: 'Erst Backup exportieren', handler: h.exportFirst },
      { text: 'Ersetzen', role: 'destructive', handler: h.confirm },
    ],
  };
}

/** Rückfrage nach fehlgeschlagenem Backup vor Reset/Import: ohne Sicherung nur auf ausdrücklichen Wunsch weiter. */
export function exportFailedDialog(reason: string, proceed: () => void): AlertOptions {
  return {
    header: 'Backup fehlgeschlagen',
    message: `${reason} Trotzdem fortfahren?`,
    buttons: [CANCEL, { text: 'Fortfahren', role: 'destructive', handler: proceed }],
  };
}

/** Dialog zur automatischen Sicherung: wiederherstellen oder löschen. */
export function safetyDialog(info: string, h: { discard: () => void; restore: () => void }): AlertOptions {
  return {
    header: 'Automatische Sicherung',
    message: `${info}. Beim Wiederherstellen wird der aktuelle Stand selbst zur automatischen Sicherung.`,
    buttons: [
      CANCEL,
      { text: 'Sicherung löschen', role: 'destructive', handler: h.discard },
      { text: 'Wiederherstellen', handler: h.restore },
    ],
  };
}

/** Zeigt einen Dialog und kehrt zurück, sobald er sichtbar ist. */
export async function presentAlert(alerts: AlertController, options: AlertOptions): Promise<void> {
  const alert = await alerts.create(options);
  await alert.present();
}

/** Einfacher Hinweisdialog mit OK. */
export function showMessage(alerts: AlertController, header: string, message: string): Promise<void> {
  return presentAlert(alerts, { header, message, buttons: ['OK'] });
}
