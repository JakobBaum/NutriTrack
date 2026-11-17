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

describe('StorageService Review 4 (Daten)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('D1 Fehlerzustand aufräumen', () => {
    it('remove() des einzigen offenen Schlüssels beendet Fehler und Wiederholung', () => {
      const store = fakeStorage();
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      store.failSet = () => true;
      service.set('diary', [1]);
      expect(service.flush()).toBe(false);
      expect(service.lastError()).not.toBeNull();
      service.remove('diary');
      expect(service.lastError()).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('flush() ohne Vorgemerktes setzt einen alten Fehler zurück', () => {
      const store = fakeStorage();
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      store.failSet = () => true;
      service.set('x', 1);
      service.flush();
      expect(service.lastError()).not.toBeNull();
      service.remove('x');
      expect(service.flush()).toBe(true);
      expect(service.lastError()).toBeNull();
    });
  });

  describe('D2 Quarantäne-Erfolg', () => {
    const rejectAll = (raw: unknown) => ({ items: [], rejected: Array.isArray(raw) ? raw : [], repaired: 0 });

    it('quarantine() liefert true bei Erfolg und false, wenn die Sicherung scheitert', () => {
      const store = fakeStorage();
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      expect(service.quarantine('diary', [{ a: 1 }], 'invalid')).toBe(true);
      store.failSet = (k) => k.startsWith('nutritrack:quarantine');
      expect(service.quarantine('diary', [{ a: 2 }], 'invalid')).toBe(false);
    });

    it('getSanitized() lässt den Roh-Schlüssel unverändert, wenn die Sicherung scheitert', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[{"kaputt":1}]' });
      store.failSet = (k) => k.startsWith('nutritrack:quarantine');
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      expect(service.getSanitized('diary', rejectAll)).toEqual([]);
      service.flush();
      expect(store.getItem('nutritrack:diary')).toBe('[{"kaputt":1}]');
    });

    it('getSanitized() schreibt den bereinigten Stand, wenn die Sicherung gelang', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[{"kaputt":1}]' });
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      service.getSanitized('diary', rejectAll);
      service.flush();
      expect(store.getItem('nutritrack:diary')).toBe('[]');
    });

    it('getObject() entfernt den Roh-Schlüssel nur nach gelungener Sicherung', () => {
      const store = fakeStorage({ 'nutritrack:profile': '{"x":1}' });
      store.failSet = (k) => k.startsWith('nutritrack:quarantine');
      vi.stubGlobal('localStorage', store);
      expect(new StorageService().getObject('profile', () => null)).toBeNull();
      expect(store.getItem('nutritrack:profile')).toBe('{"x":1}');
      store.failSet = () => false;
      expect(new StorageService().getObject('profile', () => null)).toBeNull();
      expect(store.getItem('nutritrack:profile')).toBeNull();
    });
  });

  describe('D4 replaceAll und Vorgemerktes', () => {
    it('behält Vorgemerktes, wenn der Import scheitert', () => {
      const store = fakeStorage();
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      service.set('diary', [{ id: 'neu' }]);
      store.failSet = (k) => k === 'nutritrack:recipes';
      expect(service.replaceAll({ recipes: [] })).toBe('failed');
      expect(service.pendingCount()).toBe(1);
      expect(service.get('diary', [])).toEqual([{ id: 'neu' }]);
    });

    it('behält Vorgemerktes ohne Speicher-Backend', () => {
      vi.stubGlobal('localStorage', undefined);
      const service = new StorageService();
      service.set('diary', [1]);
      expect(service.replaceAll({})).toBe('failed');
      expect(service.pendingCount()).toBe(1);
    });

    it('verwirft Vorgemerktes bei erfolgreichem Import', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const service = new StorageService();
      service.set('diary', [1]);
      expect(service.replaceAll({ recipes: [] })).toBe('ok');
      expect(service.pendingCount()).toBe(0);
    });
  });

  describe('D5 Änderung in einem anderen Fenster', () => {
    const foreign = (key: string | null): void => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    };

    it('meldet die Änderung, sperrt Schreibzugriffe und verwirft den vorgemerkten Wert dieses Schlüssels', () => {
      const store = fakeStorage();
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      service.set('diary', [1]);
      service.set('profile', { a: 1 });
      foreign('nutritrack:diary');
      expect(service.externalChange()).toBe(true);
      expect(service.writeLocked()).toBe(true);
      expect(service.set('x', 1)).toBe(false);
      service.flush();
      expect(store.getItem('nutritrack:diary')).toBeNull();
      expect(store.getItem('nutritrack:profile')).toBeNull(); // Sperre: flush schreibt nichts
      service.ngOnDestroy();
    });

    it('ignoriert fremde Schlüssel und die Quarantäne', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const service = new StorageService();
      foreign('other:key');
      foreign('nutritrack:quarantine.diary.5');
      expect(service.externalChange()).toBe(false);
      expect(service.set('x', 1)).toBe(true);
      service.ngOnDestroy();
    });

    it('behandelt "alles gelöscht" (key null) als Änderung', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const service = new StorageService();
      foreign(null);
      expect(service.externalChange()).toBe(true);
      service.ngOnDestroy();
    });

    it('hebt die Sperre nach erfolgreichem replaceAll auf', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const service = new StorageService();
      foreign('nutritrack:diary');
      expect(service.replaceAll({})).toBe('ok');
      expect(service.writeLocked()).toBe(false);
      service.ngOnDestroy();
    });
  });

  describe('D11 unlesbare Schlüssel im Snapshot', () => {
    it('listet nicht lesbare Schlüssel in skippedKeys', () => {
      vi.stubGlobal('localStorage', fakeStorage({ 'nutritrack:diary': '[]', 'nutritrack:kaputt': '{x' }));
      const result = new StorageService().snapshotDetailed();
      expect(result.data).toEqual({ diary: [] });
      expect(result.skippedKeys).toEqual(['kaputt']);
    });
  });

  describe('D14 set(undefined)', () => {
    it('entfernt den Schlüssel wie remove()', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[1]' });
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      expect(service.set('diary', undefined)).toBe(true);
      service.flush();
      expect(store.getItem('nutritrack:diary')).toBeNull();
      expect(service.snapshot()).toEqual({});
    });
  });

  describe('D15 Migration', () => {
    it('meldet einen Schreibfehler der Migration über lastError', () => {
      const store = fakeStorage({ 'nutritrack:diary': '[]' });
      store.failSet = (k) => k === 'nutritrack:schemaVersion';
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      expect(service.lastError()?.kind).toBe('quota');
      expect(service.writeFailures()).toBe(1);
    });
  });
});
