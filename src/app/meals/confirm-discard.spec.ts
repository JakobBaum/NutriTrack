import { AlertController } from '@ionic/angular';
import { describe, expect, it, vi } from 'vitest';
import { confirmDiscard } from './confirm-discard';

/** Alert-Attrappe: `close(role)` beendet den Dialog. */
function fakeAlerts() {
  const closers: ((role: string) => void)[] = [];
  const create = vi.fn(async () => ({
    present: async () => undefined,
    onDidDismiss: () => new Promise<{ role: string }>((resolve) => closers.push((role) => resolve({ role }))),
  }));
  return { alerts: { create } as unknown as AlertController, create, closers };
}

/** Wartet, bis der Dialog offen ist (create und present sind asynchron). */
const opened = (closers: unknown[]) => vi.waitFor(() => expect(closers.length).toBe(1));

describe('confirmDiscard', () => {
  it('zeigt bei Doppelaufruf nur einen Dialog und liefert beiden dieselbe Antwort', async () => {
    const { alerts, create, closers } = fakeAlerts();

    const first = confirmDiscard(alerts);
    const second = confirmDiscard(alerts);
    await opened(closers);
    closers[0]('destructive');

    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('fragt nach einer abgelehnten Abfrage erneut', async () => {
    const { alerts, create, closers } = fakeAlerts();

    const first = confirmDiscard(alerts);
    await opened(closers);
    closers[0]('cancel');
    expect(await first).toBe(false);

    const second = confirmDiscard(alerts);
    await vi.waitFor(() => expect(closers.length).toBe(2));
    closers[1]('destructive');

    expect(await second).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
