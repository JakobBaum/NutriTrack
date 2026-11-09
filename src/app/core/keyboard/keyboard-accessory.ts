import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

interface KeyboardDoneBarDeps {
  readonly platform: () => string;
  readonly plugin: Pick<typeof Keyboard, 'setAccessoryBarVisible'>;
}

const DEFAULT_DEPS: KeyboardDoneBarDeps = { platform: () => Capacitor.getPlatform(), plugin: Keyboard };

/**
 * Der iOS-Zahlenblock hat keine Return-Taste. Die Zubehörleiste über der Tastatur bringt
 * "Fertig" zurück; nur auf iOS nötig, im Web gibt es sie nicht. Liefert true, wenn sie aktiv ist.
 */
export async function showKeyboardDoneBar(deps: KeyboardDoneBarDeps = DEFAULT_DEPS): Promise<boolean> {
  if (deps.platform() !== 'ios') return false;
  try {
    await deps.plugin.setAccessoryBarVisible({ isVisible: true });
    return true;
  } catch (e) {
    console.error('NutriTrack: Fertig-Leiste der Tastatur nicht verfügbar', e);
    return false;
  }
}
