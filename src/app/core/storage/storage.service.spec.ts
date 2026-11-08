import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

/** Minimaler Storage-Ersatz; `failOn` simuliert einen vollen Speicher für einen Schlüssel. */
function memoryStorage(initial: Record<string, string>, failOn?: string): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === failOn) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe('StorageService snapshot/replaceAll', () => {
  let store: Storage;

  beforeEach(() => {
    store = memoryStorage({
      'nutritrack:diary': '[{"id":"d1"}]',
      'nutritrack:profile': '{"weightKg":80}',
      'nutritrack:broken': '{kaputt',
      'other:key': '"fremd"',
    });
    vi.stubGlobal('localStorage', store);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('snapshot returns parsed nutritrack values only and skips broken ones', () => {
    expect(new StorageService().snapshot()).toEqual({ diary: [{ id: 'd1' }], profile: { weightKg: 80 } });
  });

  it('replaceAll swaps all nutritrack keys and leaves foreign keys alone', () => {
    const ok = new StorageService().replaceAll({ recipes: [{ id: 'r1' }] });
    expect(ok).toBe(true);
    expect(store.getItem('nutritrack:diary')).toBeNull();
    expect(store.getItem('nutritrack:broken')).toBeNull();
    expect(store.getItem('nutritrack:recipes')).toBe('[{"id":"r1"}]');
    expect(store.getItem('other:key')).toBe('"fremd"');
  });

  it('replaceAll restores the previous state when writing fails', () => {
    store = memoryStorage({ 'nutritrack:diary': '[{"id":"d1"}]' }, 'nutritrack:recipes');
    vi.stubGlobal('localStorage', store);
    const ok = new StorageService().replaceAll({ profile: null, recipes: [] });
    expect(ok).toBe(false);
    expect(store.getItem('nutritrack:diary')).toBe('[{"id":"d1"}]');
    expect(store.getItem('nutritrack:profile')).toBeNull();
  });
});

describe('StorageService Schreibfehler (QAE-02)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('meldet false und zählt den Fehler, wenn der Speicher voll ist', () => {
    vi.stubGlobal('localStorage', memoryStorage({}, 'nutritrack:diary'));
    const service = new StorageService();

    const ok = service.set('diary', [{ id: 'd1' }]);

    expect(ok).toBe(false);
    expect(service.writeFailures()).toBe(1);
  });

  it('meldet true und lässt den Zähler bei Erfolg unverändert', () => {
    vi.stubGlobal('localStorage', memoryStorage({}));
    const service = new StorageService();

    const ok = service.set('diary', []);

    expect(ok).toBe(true);
    expect(service.writeFailures()).toBe(0);
  });
});
