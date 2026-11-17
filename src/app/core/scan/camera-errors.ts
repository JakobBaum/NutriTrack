/** Meldung, wenn die Kameraberechtigung fehlt (Browser und native Kamera). */
export const CAMERA_DENIED_MESSAGE =
  'Kamerazugriff nicht erlaubt. In den Einstellungen freigeben oder den Code eintippen.';

/** Der Nutzer hat die native Kamera ohne Foto geschlossen (kein Fehler, nichts anzeigen). */
export class CameraCancelledError extends Error {
  constructor() {
    super('Aufnahme abgebrochen');
    this.name = 'CameraCancelledError';
  }
}

/** Die Kameraberechtigung wurde verweigert. */
export class CameraDeniedError extends Error {
  constructor() {
    super(CAMERA_DENIED_MESSAGE);
    this.name = 'CameraDeniedError';
  }
}

const CANCELLED_RE = /cancel/i;
const DENIED_RE = /denied|permission/i;

function errorName(e: unknown): string {
  return typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '';
}

/** True, wenn die Berechtigung fehlt (getUserMedia: NotAllowedError, Capacitor: "denied"). */
export function isCameraDenied(e: unknown): boolean {
  if (e instanceof CameraDeniedError || errorName(e) === 'NotAllowedError') return true;
  return e instanceof Error && DENIED_RE.test(e.message);
}

/** Übersetzt Fehler des Capacitor-Camera-Plugins in eigene Fehlerarten; alles andere bleibt unverändert. */
export function toCameraError(e: unknown): Error {
  if (e instanceof Error && CANCELLED_RE.test(e.message)) return new CameraCancelledError();
  if (isCameraDenied(e)) return new CameraDeniedError();
  return e instanceof Error ? e : new Error(String(e));
}
