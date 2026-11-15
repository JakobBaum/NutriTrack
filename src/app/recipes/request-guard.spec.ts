import { describe, expect, it } from 'vitest';
import { RequestGuard } from './request-guard';

describe('RequestGuard', () => {
  it('lässt nur die zuletzt gestartete Anfrage gelten', () => {
    const guard = new RequestGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('entwertet laufende Anfragen beim Abbrechen', () => {
    const guard = new RequestGuard();
    const token = guard.begin();
    guard.cancel();
    expect(guard.isCurrent(token)).toBe(false);
  });
});
