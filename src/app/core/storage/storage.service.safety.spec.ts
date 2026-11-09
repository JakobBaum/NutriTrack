import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';
import { CURRENT_SCHEMA_VERSION } from './storage-schema';

interface FakeStore extends Storage {
  /** Solange true, wirft setItem für Schlüssel, die `failing` erfüllen. */
  failing: (key: string) => boolean;
  data: Map<string, string>;
}

function fakeStorage(initial: Record<string, string> = {}): FakeStore {
  const data = new Map(Object.entries(initial));
  const store: FakeStore = {
    data,
    failing: () => false,
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (store.failing(k)) throw new DOMException('voll', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  return store;
}

describe('StorageService Schreibfehler mit Retry (Welle A, Punkt 1)', () => {
  let store: FakeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store = fakeStorage();
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('behält fehlgeschlagene Werte und liest sie weiter', () => {
    const service = new StorageService();
    store.failing = (k) => k === 'nutritrack:diary';
    service.set('diary', [{ id: 'a' }]);
    service.flush();
    expect(service.get('diary', [])).toEqual([{ id: 'a' }]);
    expect(service.pendingCount()).toBe(1);
  });

  it('setzt lastError mit Art quota und Schlüsseln', () => {
    const service = new StorageService();
    store.failing = () => true;
    service.set('diary', [1]);
    service.flush();
    const err = service.lastError();
    expect(err?.kind).toBe('quota');
    expect(err?.keys).toEqual(['diary']);
    expect(service.writeFailures()).toBe(1);
  });

  it('schreibt mit Backoff erneut (5 s, dann 60 s) und räumt den Fehler nach Erfolg', () => {
    const service = new StorageService();
    store.failing = () => true;
    service.set('diary', [1]);
    vi.advanceTimersByTime(StorageService.WRITE_DELAY_MS);
    expect(service.lastError()).not.toBeNull();

    vi.advanceTimersByTime(StorageService.RETRY_DELAYS_MS[0]);
    expect(service.lastError()).not.toBeNull();
    expect(service.pendingCount()).toBe(1);

    store.failing = () => false;
    vi.advanceTimersByTime(StorageService.RETRY_DELAYS_MS[1]);
    expect(store.getItem('nutritrack:diary')).toBe('[1]');
    expect(service.lastError()).toBeNull();
    expect(service.pendingCount()).toBe(0);
  });

  it('gibt nach dem letzten Versuch auf, behält die Daten aber und meldet weiter', () => {
    const service = new StorageService();
    store.failing = () => true;
    const spy = vi.spyOn(store, 'setItem');
    service.set('diary', [1]);
    vi.advanceTimersByTime(StorageService.WRITE_DELAY_MS + 5000 + 60000 + 600000);
    const calls = spy.mock.calls.length;
    vi.advanceTimersByTime(600000);
    expect(spy.mock.calls.length).toBe(calls);
    expect(service.pendingCount()).toBe(1);
    expect(service.lastError()).not.toBeNull();
  });

  it('retryNow schreibt sofort und meldet den Erfolg', () => {
    const service = new StorageService();
    store.failing = () => true;
    service.set('diary', [1]);
    service.flush();
    store.failing = () => false;
    expect(service.retryNow()).toBe(true);
    expect(store.getItem('nutritrack:diary')).toBe('[1]');
    expect(service.lastError()).toBeNull();
  });

  it('schreibt die übrigen Schlüssel, wenn nur einer scheitert', () => {
    const service = new StorageService();
    store.failing = (k) => k === 'nutritrack:diary';
    service.set('diary', [1]);
    service.set('weight', [2]);
    service.flush();
    expect(store.getItem('nutritrack:weight')).toBe('[2]');
    expect(service.pendingCount()).toBe(1);
  });

  it('meldet fehlenden Speicher (backend null) als unavailable und behält die Werte', () => {
    vi.stubGlobal('localStorage', undefined);
    const service = new StorageService();
    service.set('diary', [1]);
    service.flush();
    expect(service.lastError()?.kind).toBe('unavailable');
    expect(service.get('diary', [])).toEqual([1]);
  });

  it('nimmt nicht schreibbare Werte in snapshot() auf (Sicherung vor Import/Reset)', () => {
    const service = new StorageService();
    store.failing = () => true;
    service.set('diary', [{ id: 'a' }]);
    expect(service.snapshot()['diary']).toEqual([{ id: 'a' }]);
  });

  it('protokolliert Fehler beim Entfernen statt sie zu verschlucken', () => {
    const service = new StorageService();
    vi.spyOn(store, 'removeItem').mockImplementation(() => { throw new Error('gesperrt'); });
    service.remove('diary');
    expect(console.error).toHaveBeenCalled();
  });

  it('stoppt Retry-Timer beim Zerstören', () => {
    const service = new StorageService();
    store.failing = () => true;
    service.set('diary', [1]);
    service.flush();
    service.ngOnDestroy();
    const spy = vi.spyOn(store, 'setItem');
    vi.advanceTimersByTime(120000);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('StorageService Schema-Version (Welle A, Punkt 2)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('schreibt bei Bestandsdaten ohne Version die aktuelle Version und lässt Daten unverändert', () => {
    const store = fakeStorage({ 'nutritrack:diary': '[{"id":"a"}]' });
    vi.stubGlobal('localStorage', store);
    new StorageService();
    expect(store.getItem('nutritrack:schemaVersion')).toBe(String(CURRENT_SCHEMA_VERSION));
    expect(store.getItem('nutritrack:diary')).toBe('[{"id":"a"}]');
  });

  it('lässt eine aktuelle Version in Ruhe', () => {
    const store = fakeStorage({ 'nutritrack:schemaVersion': String(CURRENT_SCHEMA_VERSION) });
    vi.stubGlobal('localStorage', store);
    const spy = vi.spyOn(store, 'setItem');
    new StorageService();
    expect(spy).not.toHaveBeenCalled();
  });

  it('erkennt Daten einer neueren App-Version, ändert nichts und meldet es', () => {
    const store = fakeStorage({ 'nutritrack:schemaVersion': '99', 'nutritrack:diary': '[]' });
    vi.stubGlobal('localStorage', store);
    const service = new StorageService();
    expect(service.schemaNewer()).toBe(true);
    expect(store.getItem('nutritrack:schemaVersion')).toBe('99');
  });

  it('nimmt die Version nicht in snapshot() auf', () => {
    const store = fakeStorage({ 'nutritrack:diary': '[]' });
    vi.stubGlobal('localStorage', store);
    expect(new StorageService().snapshot()).toEqual({ diary: [] });
  });

  it('überlebt einen Schreibfehler bei der Migration', () => {
    const store = fakeStorage({ 'nutritrack:diary': '[]' });
    store.failing = () => true;
    vi.stubGlobal('localStorage', store);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => new StorageService()).not.toThrow();
  });
});

describe('StorageService Quarantäne (Welle A, Punkt 3)', () => {
  let store: FakeStore;
  beforeEach(() => {
    store = fakeStorage({ 'nutritrack:schemaVersion': String(CURRENT_SCHEMA_VERSION) });
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => vi.unstubAllGlobals());

  const quarantineKeys = (): string[] => Array.from(store.data.keys()).filter((k) => k.startsWith('nutritrack:quarantine.'));

  it('sichert unlesbares JSON unter einem Quarantäne-Schlüssel, bevor es überschrieben wird', () => {
    store.data.set('nutritrack:diary', '{kaputt');
    const service = new StorageService();
    expect(service.get('diary', [])).toEqual([]);
    const keys = quarantineKeys();
    expect(keys).toHaveLength(1);
    expect(JSON.parse(store.getItem(keys[0]) as string)).toMatchObject({ key: 'diary', reason: 'parse', raw: '{kaputt' });
    expect(service.quarantineNotices()).toHaveLength(1);
  });

  it('sichert dasselbe Rohdatum pro Sitzung nur einmal', () => {
    store.data.set('nutritrack:diary', '{kaputt');
    const service = new StorageService();
    service.get('diary', []);
    service.get('diary', []);
    expect(quarantineKeys()).toHaveLength(1);
  });

  it('getSanitized legt verworfene Datensätze in Quarantäne und schreibt die bereinigte Liste zurück', () => {
    store.data.set('nutritrack:diary', JSON.stringify([{ ok: 1 }, { bad: 1 }]));
    const service = new StorageService();
    const items = service.getSanitized<{ ok: number }>('diary', (raw) => {
      const list = raw as Array<Record<string, unknown>>;
      return { items: list.filter((r) => 'ok' in r) as Array<{ ok: number }>, rejected: list.filter((r) => !('ok' in r)), repaired: 0 };
    });
    expect(items).toEqual([{ ok: 1 }]);
    service.flush();
    expect(JSON.parse(store.getItem('nutritrack:diary') as string)).toEqual([{ ok: 1 }]);
    const saved = JSON.parse(store.getItem(quarantineKeys()[0]) as string);
    expect(saved.items).toEqual([{ bad: 1 }]);
    expect(service.quarantineNotices()[0]).toMatchObject({ key: 'diary', count: 1, saved: true });
  });

  it('getSanitized lässt saubere Daten unangetastet (kein Schreiben, keine Quarantäne)', () => {
    store.data.set('nutritrack:diary', '[{"ok":1}]');
    const service = new StorageService();
    const spy = vi.spyOn(store, 'setItem');
    service.getSanitized('diary', (raw) => ({ items: raw as unknown[], rejected: [], repaired: 0 }));
    service.flush();
    expect(spy).not.toHaveBeenCalled();
    expect(quarantineKeys()).toEqual([]);
  });

  it('meldet saved=false, wenn die Quarantäne selbst nicht geschrieben werden kann', () => {
    store.data.set('nutritrack:diary', '{kaputt');
    store.failing = (k) => k.includes('quarantine');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new StorageService();
    service.get('diary', []);
    expect(service.quarantineNotices()[0].saved).toBe(false);
  });

  it('räumt alte Quarantäne-Einträge auf (höchstens 10)', () => {
    for (let i = 1; i <= 12; i++) store.data.set(`nutritrack:quarantine.diary.${i}`, '{}');
    const service = new StorageService();
    service.quarantine('weight', [1], 'invalid');
    expect(quarantineKeys().length).toBe(10);
  });

  it('dismissQuarantineNotices leert die Hinweise', () => {
    const service = new StorageService();
    service.quarantine('diary', [1, 2], 'invalid');
    service.dismissQuarantineNotices();
    expect(service.quarantineNotices()).toEqual([]);
  });

  it('clearAll entfernt auch Quarantäne und Version; replaceAll lässt Quarantäne stehen', () => {
    const service = new StorageService();
    service.quarantine('diary', [1], 'invalid');
    service.replaceAll({ profile: null });
    expect(quarantineKeys()).toHaveLength(1);
    service.clearAll();
    expect(quarantineKeys()).toHaveLength(0);
  });
});
