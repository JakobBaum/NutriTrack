import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const LIGHT_TAP_MS = 10;

/**
 * Leichtes haptisches Feedback (Speichern, Abhaken, Löschen).
 * Nativ über das Capacitor-Haptics-Plugin (iOS kennt navigator.vibrate nicht), im Web über die
 * Vibration-API, sonst ein No-op. Ein Fehler darf nie das Speichern stören.
 */
export function lightHaptic(): void {
  try {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(LIGHT_TAP_MS);
    }
  } catch {
    // Haptik ist optional (kein Gerätemotor, Plugin fehlt).
  }
}
