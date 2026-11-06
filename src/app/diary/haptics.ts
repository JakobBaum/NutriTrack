const LIGHT_TAP_MS = 10;

/** Leichtes haptisches Feedback (Speichern, Abhaken, Löschen); ohne Vibration-API ein No-op. */
export function lightHaptic(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(LIGHT_TAP_MS);
  } catch {
    // Vibration ist optional; ein Fehler darf nie das Speichern stören.
  }
}
