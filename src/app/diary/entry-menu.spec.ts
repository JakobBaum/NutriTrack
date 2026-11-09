import { describe, expect, it, vi } from 'vitest';
import { entryMenuButtons } from './entry-menu';

describe('entryMenuButtons', () => {
  it('bietet Bearbeiten, Doppelt eintragen, Löschen und Abbrechen in dieser Reihenfolge', () => {
    const buttons = entryMenuButtons(() => undefined);
    expect(buttons.map((b) => b.text)).toEqual(['Bearbeiten', 'Doppelt eintragen', 'Löschen', 'Abbrechen']);
  });

  it('markiert Löschen als destruktiv und Abbrechen als cancel', () => {
    const buttons = entryMenuButtons(() => undefined);
    expect(buttons[2].role).toBe('destructive');
    expect(buttons[3].role).toBe('cancel');
  });

  it('meldet die gewählte Aktion', () => {
    const pick = vi.fn();
    const buttons = entryMenuButtons(pick);
    buttons[1].handler?.();
    expect(pick).toHaveBeenCalledWith('duplicate');
  });
});
