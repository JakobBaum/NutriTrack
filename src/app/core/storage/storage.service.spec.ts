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

  it('zählt den Fehler beim Schreiben, wenn der Speicher voll ist', () => {
    vi.stubGlobal('localStorage', memoryStorage({}, 'nutritrack:diary'));
    const service = new StorageService();

    service.set('diary', [{ id: 'd1' }]);
    service.flush();

    expect(service.writeFailures()).toBe(1);
  });

  it('lässt den Zähler bei Erfolg unverändert', () => {
    vi.stubGlobal('localStorage', memoryStorage({}));
    const service = new StorageService();

    service.set('diary', []);
    service.flush();

    expect(service.writeFailures()).toBe(0);
  });
});

describe('StorageService gebündeltes Schreiben (PRF-09)', () => {
  let store: Storage;
  let setItem: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = memoryStorage({});
    setItem = vi.spyOn(store, 'setItem');
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('bündelt mehrere Schreibzugriffe auf einen localStorage-Zugriff', () => {
    const service = new StorageService();
    service.set('diary', [1]);
    service.set('diary', [1, 2]);
    service.set('diary', [1, 2, 3]);
    expect(setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(StorageService.WRITE_DELAY_MS);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(store.getItem('nutritrack:diary')).toBe('[1,2,3]');
  });

  it('liest sofort den neuesten, noch nicht geschriebenen Wert', () => {
    const service = new StorageService();
    service.set('diary', [{ id: 'a' }]);
    expect(service.get('diary', [])).toEqual([{ id: 'a' }]);
    expect(service.snapshot()).toEqual({ diary: [{ id: 'a' }] });
  });

  it.each(['pagehide', 'beforeunload'])('schreibt sofort bei %s (kein Datenverlust)', (eventName) => {
    const service = new StorageService();
    service.set('weight', [80]);
    window.dispatchEvent(new Event(eventName));
    expect(store.getItem('nutritrack:weight')).toBe('[80]');
  });

  it('schreibt sofort, wenn die Seite in den Hintergrund geht (visibilitychange)', () => {
    const service = new StorageService();
    service.set('weight', [81]);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(store.getItem('nutritrack:weight')).toBe('[81]');
  });

  it('schreibt beim Zerstören des Dienstes', () => {
    const service = new StorageService();
    service.set('weight', [82]);
    service.ngOnDestroy();
    expect(store.getItem('nutritrack:weight')).toBe('[82]');
  });

  it('verwirft ausstehende Werte bei remove und clearAll', () => {
    const service = new StorageService();
    service.set('a', 1);
    service.remove('a');
    service.set('b', 2);
    service.clearAll();
    service.flush();
    expect(store.getItem('nutritrack:a')).toBeNull();
    expect(store.getItem('nutritrack:b')).toBeNull();
  });
});
