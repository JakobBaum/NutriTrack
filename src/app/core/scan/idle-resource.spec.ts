import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleResource } from './idle-resource';

function makeFactory() {
  const created: { terminate: ReturnType<typeof vi.fn> }[] = [];
  const create = vi.fn(async () => {
    const r = { terminate: vi.fn(async () => undefined) };
    created.push(r);
    return r;
  });
  return { create, created };
}

describe('IdleResource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('creates the resource lazily and reuses it for later jobs', async () => {
    const { create } = makeFactory();
    const res = new IdleResource(create, 60_000);
    expect(create).not.toHaveBeenCalled();
    await res.use(async () => 1);
    await res.use(async () => 2);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('shares one instance between concurrent jobs', async () => {
    const { create } = makeFactory();
    const res = new IdleResource(create, 60_000);
    await Promise.all([res.use(async () => 1), res.use(async () => 2)]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('terminates after the idle timeout and recreates on next use', async () => {
    const { create, created } = makeFactory();
    const res = new IdleResource(create, 60_000);
    await res.use(async () => 1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(created[0].terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(created[0].terminate).toHaveBeenCalledTimes(1);
    expect(res.isAlive).toBe(false);
    await res.use(async () => 2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('restarts the idle timer on each use', async () => {
    const { create, created } = makeFactory();
    const res = new IdleResource(create, 60_000);
    await res.use(async () => 1);
    await vi.advanceTimersByTimeAsync(40_000);
    await res.use(async () => 2);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(created[0].terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(21_000);
    expect(created[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('does not terminate while a job is still running', async () => {
    const { create, created } = makeFactory();
    const res = new IdleResource(create, 1_000);
    let release!: () => void;
    const slow = res.use(() => new Promise<void>((r) => (release = r)));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(created[0].terminate).not.toHaveBeenCalled();
    release();
    await slow;
    await vi.advanceTimersByTimeAsync(1_001);
    expect(created[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('discards the resource when a job fails', async () => {
    const { create, created } = makeFactory();
    const res = new IdleResource(create, 60_000);
    await expect(res.use(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(0);
    expect(created[0].terminate).toHaveBeenCalledTimes(1);
    await res.use(async () => 1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries creation after a failed create', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new Error('no worker'))
      .mockResolvedValue({ terminate: vi.fn(async () => undefined) });
    const res = new IdleResource(create, 60_000);
    await expect(res.use(async () => 1)).rejects.toThrow('no worker');
    await expect(res.use(async () => 2)).resolves.toBe(2);
  });
});
