import { afterEach, describe, expect, it, vi } from 'vitest';
import { HapticsPlatform, lightHaptic } from './haptics';

function platformOf(isNative: boolean, impactLight = vi.fn(() => Promise.resolve())): HapticsPlatform & {
  impactLight: ReturnType<typeof vi.fn>;
} {
  return { isNative: () => isNative, impactLight };
}

describe('lightHaptic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nutzt auf nativen Plattformen das Haptics-Plugin mit leichtem Impuls', () => {
    const platform = platformOf(true);
    lightHaptic(platform);
    expect(platform.impactLight).toHaveBeenCalledTimes(1);
  });

  it('faellt im Web auf navigator.vibrate zurueck', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const platform = platformOf(false);
    lightHaptic(platform);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(platform.impactLight).not.toHaveBeenCalled();
  });

  it('wirft im Web ohne Vibration-API nicht', () => {
    vi.stubGlobal('navigator', {});
    expect(() => lightHaptic(platformOf(false))).not.toThrow();
  });

  it('schluckt Fehler des Plugins (auch asynchrone)', async () => {
    const platform = platformOf(true, vi.fn(() => Promise.reject(new Error('nicht verfuegbar'))));
    expect(() => lightHaptic(platform)).not.toThrow();
    await Promise.resolve();
  });

  it('schluckt synchrone Fehler der Plattformabfrage', () => {
    const platform: HapticsPlatform = {
      isNative: () => {
        throw new Error('kaputt');
      },
      impactLight: () => Promise.resolve(),
    };
    expect(() => lightHaptic(platform)).not.toThrow();
  });
});
