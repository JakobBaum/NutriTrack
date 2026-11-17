import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';
import { CURRENT_SCHEMA_VERSION } from './storage-schema';

interface FakeStore extends Storage {
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

const isQuarantineWrite = (k: string): boolean => k.startsWith('nutritrack:quarantine.');

describe('StorageService ungesicherte Schlüssel und Migrationsfehler', () => {
  let store: FakeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store = fakeStorage({ 'nutritrack:schemaVersion': JSON.stringify(CURRENT_SCHEMA_VERSION) });
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function withUnsecuredDiary(): StorageService {
    const service = new StorageService();
    store.failing = isQuarantineWrite;
    service.quarantine('diary', [{ bad: 1 }], 'invalid');
    return service;
  }

  it('meldet einen ungesicherten Schlüssel als gesperrt', () => {
    const service = withUnsecuredDiary();
    expect(service.hasUnsecured('diary')).toBe(true);
    expect(service.hasUnsecured('weight')).toBe(false);
    expect(service.isLockedFor('diary')()).toBe(true);
    expect(service.isLockedFor('weight')()).toBe(false);
  });

  it('lehnt set auf einen ungesicherten Schlüssel ab und zeigt den Fehler', () => {
    const service = withUnsecuredDiary();
    expect(service.set('diary', [])).toBe(false);
    expect(service.lastError()).not.toBeNull();
  });

  it('löscht den Fehler bei flush ohne vorgemerkte Werte nicht, solange der Schlüssel ungesichert ist', () => {
    const service = withUnsecuredDiary();
    service.set('diary', []);
    expect(service.lastError()).not.toBeNull();
    service.flush();
    expect(service.lastError()).not.toBeNull();
    expect(service.hasUnsecured('diary')).toBe(true);
  });

  it('retryNow versucht die Quarantäne erneut, hebt die Sperre auf und löscht den Fehler', () => {
    const service = withUnsecuredDiary();
    service.set('diary', []);
    store.failing = () => false;
    expect(service.retryNow()).toBe(true);
    expect(service.hasUnsecured('diary')).toBe(false);
    expect(service.lastError()).toBeNull();
    expect(service.set('diary', [])).toBe(true);
  });

  it('retryNow bleibt bei Fehler, wenn die Quarantäne weiter scheitert', () => {
    const service = withUnsecuredDiary();
    expect(service.retryNow()).toBe(false);
    expect(service.lastError()).not.toBeNull();
  });

  it('lehnt App-Daten bei Migrationsfehler ab, Cache-Schlüssel nicht', () => {
    const old = fakeStorage({ 'nutritrack:diary': '[]' });
    old.failing = (k) => k === 'nutritrack:schemaVersion';
    vi.stubGlobal('localStorage', old);
    const service = new StorageService();
    expect(service.lastError()).not.toBeNull();
    expect(service.set('diary', [1])).toBe(false);
    expect(service.isLockedFor('diary')()).toBe(true);
  });

  describe('Quarantäne bei gesperrtem Schlüssel', () => {
    const quarantineKeys = (): string[] => Array.from(store.data.keys()).filter((k) => k.startsWith('nutritrack:quarantine'));
    const blockedStore = (): FakeStore => {
      const old = fakeStorage({ 'nutritrack:diary': '[1,"bad"]', 'nutritrack:profile': '{"x":1}' });
      old.failing = (k) => k === 'nutritrack:schemaVersion';
      vi.stubGlobal('localStorage', old);
      store = old;
      return old;
    };
    const keepNumbers = (raw: unknown) => {
      const list = Array.isArray(raw) ? raw : [];
      return { items: list.filter((v) => typeof v === 'number'), rejected: list.filter((v) => typeof v !== 'number'), repaired: 0 };
    };

    it('getSanitized schreibt bei Migrationssperre nichts, merkt den Schlüssel aber als ungesichert vor', () => {
      blockedStore();
      const service = new StorageService();
      expect(service.getSanitized<number>('diary', keepNumbers)).toEqual([1]);
      expect(quarantineKeys()).toEqual([]);
      expect(store.data.get('nutritrack:diary')).toBe('[1,"bad"]');
      expect(service.hasUnsecured('diary')).toBe(true);
      expect(service.isLockedFor('diary')()).toBe(true);
      expect(service.quarantineNotices()).toEqual([{ key: 'diary', count: 1, saved: false }]);
    });

    it('getObject schreibt bei Migrationssperre nichts, merkt den Schlüssel aber als ungesichert vor', () => {
      blockedStore();
      const service = new StorageService();
      expect(service.getObject('profile', () => null)).toBeNull();
      expect(quarantineKeys()).toEqual([]);
      expect(store.data.get('nutritrack:profile')).toBe('{"x":1}');
      expect(service.hasUnsecured('profile')).toBe(true);
    });

    it('wiederholte Starts mit Migrationssperre erzeugen keine neuen Quarantäne-Einträge', () => {
      blockedStore();
      for (let i = 0; i < 3; i++) new StorageService().getSanitized<number>('diary', keepNumbers);
      expect(quarantineKeys()).toEqual([]);
    });

    it('mehrfaches Lesen unter Sperre erzeugt nur einen Hinweis', () => {
      blockedStore();
      const service = new StorageService();
      service.getSanitized<number>('diary', keepNumbers);
      service.getSanitized<number>('diary', keepNumbers);
      expect(service.quarantineNotices()).toHaveLength(1);
    });

    it('Migrationsfehler, Erneut versuchen, Schreiben: der verworfene Datensatz liegt vorher in der Quarantäne', () => {
      const old = blockedStore();
      const service = new StorageService();
      service.getSanitized<number>('diary', keepNumbers);
      expect(service.set('diary', [1])).toBe(false);
      expect(store.data.get('nutritrack:diary')).toBe('[1,"bad"]');

      old.failing = () => false;
      expect(service.retryNow()).toBe(true);
      expect(service.hasUnsecured('diary')).toBe(false);
      expect(quarantineKeys()).toHaveLength(1);
      expect(store.data.get(quarantineKeys()[0])).toContain('bad');
      expect(service.quarantineNotices()).toEqual([{ key: 'diary', count: 1, saved: true }]);

      // Der bereinigte Stand wird zurückgeschrieben: Der nächste Start sichert nichts doppelt.
      service.flush();
      expect(store.data.get('nutritrack:diary')).toBe('[1]');
      const next = new StorageService();
      next.getSanitized<number>('diary', keepNumbers);
      expect(quarantineKeys()).toHaveLength(1);

      expect(service.set('diary', [1])).toBe(true);
      service.flush();
      expect(store.data.get('nutritrack:diary')).toBe('[1]');
    });

    it('Migrationsfehler, Erneut versuchen: ein unbrauchbares Profil wird vor dem Überschreiben gesichert', () => {
      const old = blockedStore();
      const service = new StorageService();
      expect(service.getObject('profile', () => null)).toBeNull();
      expect(service.set('profile', { fresh: true })).toBe(false);

      old.failing = () => false;
      expect(service.retryNow()).toBe(true);
      expect(quarantineKeys()).toHaveLength(1);
      expect(store.data.get(quarantineKeys()[0])).toContain('"x":1');
      expect(store.data.has('nutritrack:profile')).toBe(false);
      expect(service.set('profile', { fresh: true })).toBe(true);
    });

    it('sichert bei Erneut versuchen auch bei weiter scheiternder Migration, schreibt aber den Schlüssel nicht', () => {
      blockedStore();
      const service = new StorageService();
      service.getSanitized<number>('diary', keepNumbers);
      expect(service.retryNow()).toBe(false);
      expect(service.hasUnsecured('diary')).toBe(false);
      expect(quarantineKeys()).toHaveLength(1);
      expect(service.set('diary', [1])).toBe(false);
      expect(store.data.get('nutritrack:diary')).toBe('[1,"bad"]');
    });

    it('bei neuerem Schema wird nichts vorgemerkt (alles bleibt unangetastet)', () => {
      store.data.set('nutritrack:schemaVersion', JSON.stringify(CURRENT_SCHEMA_VERSION + 1));
      store.data.set('nutritrack:diary', '[1,"bad"]');
      const service = new StorageService();
      expect(service.getSanitized<number>('diary', keepNumbers)).toEqual([1]);
      expect(service.hasUnsecured('diary')).toBe(false);
      expect(quarantineKeys()).toEqual([]);
    });
  });

  it('setzt den Migrationsfehler nach erfolgreichem clearAll zurück', () => {
    const old = fakeStorage({ 'nutritrack:diary': '[]' });
    old.failing = (k) => k === 'nutritrack:schemaVersion';
    vi.stubGlobal('localStorage', old);
    const service = new StorageService();
    old.failing = () => false;
    expect(service.clearAll()).toBe(true);
    expect(service.lastError()).toBeNull();
    expect(service.set('diary', [1])).toBe(true);
  });

  it('setzt den Migrationsfehler nach erfolgreichem replaceAll zurück', () => {
    const old = fakeStorage({ 'nutritrack:diary': '[]' });
    old.failing = (k) => k === 'nutritrack:schemaVersion';
    vi.stubGlobal('localStorage', old);
    const service = new StorageService();
    old.failing = () => false;
    expect(service.replaceAll({ diary: [] })).toBe('ok');
    expect(service.lastError()).toBeNull();
  });

  it('meldet zwei Fremdänderungen im selben Takt, ohne die Zustimmung zu verschlucken', () => {
    const service = new StorageService();
    const prefix = 'nutritrack:';
    window.dispatchEvent(new StorageEvent('storage', { key: `${prefix}consent` }));
    window.dispatchEvent(new StorageEvent('storage', { key: `${prefix}foodCache` }));
    expect(service.consentChanges()).toBe(1);
  });
});
