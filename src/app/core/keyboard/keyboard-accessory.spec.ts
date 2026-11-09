import { describe, expect, it, vi } from 'vitest';
import { showKeyboardDoneBar } from './keyboard-accessory';

describe('showKeyboardDoneBar', () => {
  it('blendet auf iOS die Fertig-Leiste ein', async () => {
    const setAccessoryBarVisible = vi.fn().mockResolvedValue(undefined);

    const shown = await showKeyboardDoneBar({ platform: () => 'ios', plugin: { setAccessoryBarVisible } });

    expect(shown).toBe(true);
    expect(setAccessoryBarVisible).toHaveBeenCalledWith({ isVisible: true });
  });

  it.each(['web', 'android'])('tut auf %s nichts', async (platform) => {
    const setAccessoryBarVisible = vi.fn();

    const shown = await showKeyboardDoneBar({ platform: () => platform, plugin: { setAccessoryBarVisible } });

    expect(shown).toBe(false);
    expect(setAccessoryBarVisible).not.toHaveBeenCalled();
  });

  it('protokolliert einen Fehler des Plugins, statt ihn zu verschlucken', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const setAccessoryBarVisible = vi.fn().mockRejectedValue(new Error('nicht verfügbar'));

    const shown = await showKeyboardDoneBar({ platform: () => 'ios', plugin: { setAccessoryBarVisible } });

    expect(shown).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
