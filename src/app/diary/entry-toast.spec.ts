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

  it('Rückgängig-Hinweis dauert 3500 ms, normale Meldung 2500 ms', async () => {
    const withUndo = controller();
    const plain = controller();

    await showEntryToast(withUndo.ctrl, 'Eingetragen', () => undefined);
    await showEntryToast(plain.ctrl, 'Eingetragen');

    expect(withUndo.create.mock.calls[0][0].duration).toBe(3500);
    expect(plain.create.mock.calls[0][0].duration).toBe(2500);
  });

  it('lässt sich vertikal wegwischen', async () => {
    const { ctrl, create } = controller();

    await showEntryToast(ctrl, 'Eingetragen', () => undefined);

    expect(create.mock.calls[0][0].swipeGesture).toBe('vertical');
  });
});
