import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

interface FakeStore extends Storage {
  failSet: (key: string) => boolean;
  failRemove: (key: string) => boolean;
  data: Map<string, string>;
}

function fakeStorage(initial: Record<string, string> = {}): FakeStore {
  const data = new Map(Object.entries(initial));
  const store: FakeStore = {
    data,
    failSet: () => false,
    failRemove: () => false,
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (store.failSet(k)) throw new DOMException('voll', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => {
      if (store.failRemove(k)) throw new DOMException('gesperrt', 'SecurityError');
      data.delete(k);
    },
    clear: () => data.clear(),
  };
  return store;
}

describe('StorageService Fehlerwege (Review 3, Befunde 2 bis 4)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('clearAll', () => {
    it('liefert true, wenn alles gelöscht wurde', () => {
      vi.stubGlobal('localStorage', fakeStorage({ 'nutritrack:diary': '[]' }));
      expect(new StorageService().clearAll()).toBe(true);
    });

    it('liefert false, wenn das Löschen scheitert', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[]', 'nutritrack:schemaVersion': '1' });
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      store.failRemove = (k) => k === 'nutritrack:diary';
      expect(service.clearAll()).toBe(false);
    });
  });

  describe('replaceAll', () => {
    it('meldet ok bei Erfolg', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      expect(new StorageService().replaceAll({ recipes: [] })).toBe('ok');
    });

    it('meldet failed, wenn der vorherige Stand wiederhergestellt wurde', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[{"id":"d1"}]' });
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      store.failSet = (k) => k === 'nutritrack:recipes';
      expect(service.replaceAll({ recipes: [] })).toBe('failed');
      expect(store.getItem('nutritrack:diary')).toBe('[{"id":"d1"}]');
    });

    it('meldet rollbackFailed, wenn auch die Wiederherstellung scheitert', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[{"id":"d1"}]' });
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      store.failSet = (k) => k === 'nutritrack:recipes' || k === 'nutritrack:diary';
      expect(service.replaceAll({ recipes: [] })).toBe('rollbackFailed');
    });
  });

  describe('Schema neuer als die App', () => {
    function newerService(): { store: FakeStore; service: StorageService } {
      const store = fakeStorage({ 'nutritrack:schemaVersion': '99', 'nutritrack:diary': '[{"id":"neu"}]' });
      vi.stubGlobal('localStorage', store);
      return { store, service: new StorageService() };
    }

    it('schreibt über set() nichts, auch nicht nach flush()', () => {
      vi.useFakeTimers();
      const { store, service } = newerService();
      expect(service.schemaNewer()).toBe(true);
      service.set('diary', []);
      service.set('profile', { weightKg: 80 });
      expect(service.pendingCount()).toBe(0);
      service.flush();
      expect(store.getItem('nutritrack:diary')).toBe('[{"id":"neu"}]');
      expect(store.getItem('nutritrack:profile')).toBeNull();
    });

    it('liefert die gespeicherten Daten weiter über get()', () => {
      const { service } = newerService();
      service.set('diary', []);
      expect(service.get('diary', [])).toEqual([{ id: 'neu' }]);
    });

    it('löscht über remove() nichts', () => {
      const { store, service } = newerService();
      service.remove('diary');
      expect(store.getItem('nutritrack:diary')).toBe('[{"id":"neu"}]');
    });

    it('legt über quarantine() nichts an, meldet es aber als nicht gesichert', () => {
      const { store, service } = newerService();
      service.quarantine('profile', [{ goal: 'neu' }], 'invalid');
      expect(Array.from(store.data.keys()).some((k) => k.includes('quarantine'))).toBe(false);
      expect(service.quarantineNotices()).toEqual([{ key: 'profile', count: 1, saved: false }]);
    });

    it('set() meldet, dass nichts vorgemerkt wurde', () => {
      const { service } = newerService();
      expect(service.set('diary', [])).toBe(false);
    });

    it('erlaubt den Nutzer-Reset und hebt danach die Sperre auf', () => {
      const { store, service } = newerService();
      expect(service.clearAll()).toBe(true);
      expect(store.getItem('nutritrack:diary')).toBeNull();
      expect(service.schemaNewer()).toBe(false);
      expect(service.set('diary', [{ id: 'x' }])).toBe(true);
      expect(service.flush()).toBe(true);
      expect(store.getItem('nutritrack:diary')).toBe('[{"id":"x"}]');
    });

    it('hebt die Sperre nach erfolgreichem replaceAll auf', () => {
      const { service } = newerService();
      expect(service.replaceAll({ diary: [] })).toBe('ok');
      expect(service.schemaNewer()).toBe(false);
    });

    it('behält die Sperre, wenn replaceAll scheitert', () => {
      const { store, service } = newerService();
      store.failSet = (k) => k === 'nutritrack:diary';
      expect(service.replaceAll({ diary: [] })).not.toBe('ok');
      expect(service.schemaNewer()).toBe(true);
    });
  });
});
