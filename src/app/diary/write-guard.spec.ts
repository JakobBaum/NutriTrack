import { ToastController } from '@ionic/angular';
import { describe, expect, it, vi } from 'vitest';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { ensureWritable } from './write-guard';

function toasts() {
  const create = vi.fn().mockResolvedValue({ present: vi.fn() });
  return { ctrl: { create, getTop: vi.fn().mockResolvedValue(undefined) } as unknown as ToastController, create };
}

describe('ensureWritable', () => {
  it('erlaubt das Schreiben ohne Sperre und zeigt nichts', () => {
    const { ctrl, create } = toasts();
    expect(ensureWritable({ isReadOnly: () => false }, ctrl)).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('zeigt bei Sperre die Sperrmeldung und verweigert das Schreiben', async () => {
    const { ctrl, create } = toasts();
    expect(ensureWritable({ isReadOnly: () => true }, ctrl)).toBe(false);
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0].message).toBe(WRITE_BLOCKED_MESSAGE);
  });
});
