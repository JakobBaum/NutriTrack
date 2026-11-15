import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const LIGHT_TAP_MS = 10;

/** Zugriff auf die Plattform; im Test ersetzbar, ohne Module zu mocken. */
export interface HapticsPlatform {
  readonly isNative: () => boolean;
  readonly impactLight: () => Promise<void>;
}

const NATIVE_PLATFORM: HapticsPlatform = {
  isNative: () => Capacitor.isNativePlatform(),
  impactLight: () => Haptics.impact({ style: ImpactStyle.Light }),
};

/**
 * Leichtes haptisches Feedback (Speichern, Abhaken, Löschen).
 * Nativ über das Capacitor-Haptics-Plugin (iOS kennt navigator.vibrate nicht), im Web über die
 * Vibration-API, sonst ein No-op. Ein Fehler darf nie das Speichern stören.
 */
export function lightHaptic(platform: HapticsPlatform = NATIVE_PLATFORM): void {
  try {
    if (platform.isNative()) {
      platform.impactLight().catch(() => undefined);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(LIGHT_TAP_MS);
    }
  } catch {
    // Haptik ist optional (kein Gerätemotor, Plugin fehlt).
  }
}
