import { describe, expect, it, vi } from 'vitest';
import { watchReducedMotion } from './reduced-motion';

function fakeQuery(matches: boolean) {
  const listeners: Array<() => void> = [];
  const query = {
    matches,
    addEventListener: (_: string, l: () => void) => listeners.push(l),
    removeEventListener: (_: string, l: () => void) => listeners.splice(listeners.indexOf(l), 1),
  };
  return { query, listeners };
}

describe('watchReducedMotion', () => {
  it('wendet den aktuellen Wert sofort an', () => {
    const { query } = fakeQuery(true);
    const apply = vi.fn();
    watchReducedMotion(() => query as unknown as MediaQueryList, apply);
    expect(apply).toHaveBeenCalledWith(false);
  });

  it('folgt einer Änderung zur Laufzeit', () => {
    const { query, listeners } = fakeQuery(false);
    const apply = vi.fn();
    watchReducedMotion(() => query as unknown as MediaQueryList, apply);
    (query as { matches: boolean }).matches = true;
    listeners.forEach((l) => l());
    expect(apply).toHaveBeenLastCalledWith(false);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('meldet sich ab und tut ohne matchMedia nichts', () => {
    const { query, listeners } = fakeQuery(false);
    const stop = watchReducedMotion(() => query as unknown as MediaQueryList, vi.fn());
    stop();
    expect(listeners).toHaveLength(0);
    const apply = vi.fn();
    watchReducedMotion(() => null, apply);
    expect(apply).not.toHaveBeenCalled();
  });
});
