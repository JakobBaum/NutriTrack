/** Deutsche Meldungen zu Speicherproblemen (Satz, dann konkreter nächster Schritt; keine Rohfehler). */
import type { StorageError } from './storage.service';

const NEXT_STEP = 'Exportiere jetzt ein Backup';

const MESSAGES: Readonly<Record<StorageError['kind'], string>> = {
  quota: `Speichern fehlgeschlagen: Der Gerätespeicher ist voll. Neue Änderungen sind noch nicht gesichert. ${NEXT_STEP} und gib Speicher frei.`,
  unavailable: `Deine Daten werden nicht dauerhaft gespeichert: Der Speicher dieses Geräts ist gesperrt. ${NEXT_STEP}, damit nichts verloren geht.`,
  unknown: `Speichern fehlgeschlagen: Neue Änderungen sind noch nicht gesichert. ${NEXT_STEP} und versuche es dann erneut.`,
};

export const SCHEMA_NEWER_MESSAGE =
  'Diese Daten stammen aus einer neueren NutriTrack-Version. Aktualisiere die App, bevor du etwas änderst.';

/** Meldung für das Fehler-Banner. */
export function describeStorageError(error: StorageError): string {
  return MESSAGES[error.kind] ?? MESSAGES.unknown;
}
