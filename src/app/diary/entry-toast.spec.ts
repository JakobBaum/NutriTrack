import { describe, expect, it, vi } from 'vitest';
import { ToastController } from '@ionic/angular';
import { showEntryToast } from './entry-toast';

function controller() {
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });
  const getTop = vi.fn().mockResolvedValue(undefined);
  return { ctrl: { create, getTop } as unknown as ToastController, create };
}

describe('showEntryToast (IOS-01)', () => {
  it('erscheint oben, damit der Hauptbutton unten im Sheet nicht verdeckt wird', async () => {
    const { ctrl, create } = controller();

    await showEntryToast(ctrl, 'Eingetragen');

    expect(create.mock.calls[0][0].position).toBe('top');
  });

  it('bietet Rückgängig nur mit Callback an', async () => {
    const { ctrl, create } = controller();

    await showEntryToast(ctrl, 'Eingetragen', () => undefined);

    expect(create.mock.calls[0][0].buttons).toHaveLength(1);
  });
});
