import { afterEach, describe, expect, it, vi } from 'vitest';

const impact = vi.fn((_o?: unknown) => Promise.resolve());
const isNativePlatform = vi.fn(() => false);

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: (o: unknown) => impact(o) },
  ImpactStyle: { Light: 'LIGHT' },
}));

import { lightHaptic } from './haptics';

describe('lightHaptic', () => {
  afterEach(() => {
    impact.mockReset();
    impact.mockImplementation(() => Promise.resolve());
    isNativePlatform.mockReset();
    isNativePlatform.mockReturnValue(false);
    vi.unstubAllGlobals();
  });

  it('nutzt auf nativen Plattformen das Haptics-Plugin mit leichtem Impuls', () => {
    isNativePlatform.mockReturnValue(true);
    lightHaptic();
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('faellt im Web auf navigator.vibrate zurueck', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    lightHaptic();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(impact).not.toHaveBeenCalled();
  });

  it('wirft im Web ohne Vibration-API nicht', () => {
    vi.stubGlobal('navigator', {});
    expect(() => lightHaptic()).not.toThrow();
  });

  it('schluckt Fehler des Plugins (auch asynchrone)', async () => {
    isNativePlatform.mockReturnValue(true);
    impact.mockImplementation(() => Promise.reject(new Error('nicht verfuegbar')));
    expect(() => lightHaptic()).not.toThrow();
    await Promise.resolve();
  });
});
