import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

interface FakeStore extends Storage {
  failSet: (key: string) => boolean;
  data: Map<string, string>;
}

function fakeStorage(initial: Record<string, string> = {}): FakeStore {
  const data = new Map(Object.entries(initial));
  const store: FakeStore = {
    data,
    failSet: () => false,
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (store.failSet(k)) throw new DOMException('voll', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  return store;
}

const isQuarantineWrite = (k: string): boolean => k.startsWith('nutritrack:quarantine.');

describe('StorageService Prüfrunde 2', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('D15 Migrationsfehler', () => {
    const setup = (): { store: FakeStore; service: StorageService } => {
      const store = fakeStorage({ 'nutritrack:diary': '[]' });
      store.failSet = (k) => k === 'nutritrack:schemaVersion';
      vi.stubGlobal('localStorage', store);
      return { store, service: new StorageService() };
    };

    it('bleibt nach einem erfolgreichen flush bestehen', () => {
      const { service } = setup();
      expect(service.lastError()?.keys).toContain('schemaVersion');
      service.set('profile', { a: 1 });
      expect(service.flush()).toBe(true);
      expect(service.lastError()?.keys).toContain('schemaVersion');
    });

    it('bleibt nach remove und clearAll-freiem Schreiben bestehen', () => {
      const { service } = setup();
      service.remove('diary');
      expect(service.lastError()?.keys).toContain('schemaVersion');
    });

    it('retryNow wiederholt die Migration und löscht den Fehler erst bei Erfolg', () => {
      const { store, service } = setup();
      service.retryNow();
      expect(service.lastError()?.keys).toContain('schemaVersion');
      store.failSet = () => false;
      service.retryNow();
      expect(service.lastError()).toBeNull();
      expect(store.data.get('nutritrack:schemaVersion')).toBe('1');
    });
  });

  describe('D2 Quarantäne gescheitert', () => {
    const setup = (): { store: FakeStore; service: StorageService } => {
      const store = fakeStorage({ 'nutritrack:schemaVersion': '1', 'nutritrack:diary': '{kaputt' });
      store.failSet = isQuarantineWrite;
      vi.stubGlobal('localStorage', store);
      return { store, service: new StorageService() };
    };

    it('lehnt set auf den Schlüssel ab, solange die Rohdaten nicht gesichert sind', () => {
      const { store, service } = setup();
      expect(service.get('diary', [])).toEqual([]);
      expect(service.set('diary', [{ id: 'neu' }])).toBe(false);
      expect(service.lastError()?.keys).toEqual(['diary']);
      service.flush();
      expect(store.data.get('nutritrack:diary')).toBe('{kaputt');
    });

    it('lehnt remove ab, ohne die Rohdaten zu löschen', () => {
      const { store, service } = setup();
      service.get('diary', []);
      service.remove('diary');
      expect(store.data.get('nutritrack:diary')).toBe('{kaputt');
    });

    it('versucht die Quarantäne vor dem Schreiben erneut und schreibt dann', () => {
      const { store, service } = setup();
      service.get('diary', []);
      store.failSet = () => false;
      expect(service.set('diary', [{ id: 'neu' }])).toBe(true);
      service.flush();
      expect(store.data.get('nutritrack:diary')).toBe('[{"id":"neu"}]');
      expect(Array.from(store.data.keys()).some(isQuarantineWrite)).toBe(true);
    });

    it('lässt andere Schlüssel unberührt', () => {
      const { service } = setup();
      service.get('diary', []);
      expect(service.set('profile', { a: 1 })).toBe(true);
    });

    it('clearAll hebt die Markierung auf', () => {
      const { service } = setup();
      service.get('diary', []);
      service.clearAll();
      expect(service.set('diary', [1])).toBe(true);
    });

    it('schützt auch verworfene Datensätze aus getSanitized', () => {
      const store = fakeStorage({ 'nutritrack:schemaVersion': '1', 'nutritrack:diary': '[1,2]' });
      store.failSet = isQuarantineWrite;
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      service.getSanitized('diary', () => ({ items: [], rejected: [1, 2], repaired: 0 }));
      expect(service.set('diary', [])).toBe(false);
      service.flush();
      expect(store.data.get('nutritrack:diary')).toBe('[1,2]');
    });
  });

  describe('Fremdänderung: Cache/Meta sperren nicht', () => {
    const foreign = (key: string | null): void => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    };

    it.each(['translations', 'lastBackup', 'autosnapshot', 'backupReminderSnooze', 'weightHintDismissedAtKg'])(
      '%s sperrt nicht',
      (key) => {
        vi.stubGlobal('localStorage', fakeStorage());
        const service = new StorageService();
        foreign(`nutritrack:${key}`);
        expect(service.externalChange()).toBe(false);
        expect(service.set('x', 1)).toBe(true);
        service.ngOnDestroy();
      },
    );

    it('die Schema-Version sperrt weiterhin', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const service = new StorageService();
      foreign('nutritrack:schemaVersion');
      expect(service.externalChange()).toBe(true);
      service.ngOnDestroy();
    });

    it('consent sperrt nicht, meldet aber die Änderung und verwirft Vorgemerktes', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const service = new StorageService();
      service.set('consent', { a: 1 });
      foreign('nutritrack:consent');
      expect(service.externalChange()).toBe(false);
      expect(service.pendingCount()).toBe(0);
      expect(service.foreignChange()?.key).toBe('consent');
      service.ngOnDestroy();
    });

    it('flush schreibt bei aktiver Sperre nichts', () => {
      const store = fakeStorage();
      vi.stubGlobal('localStorage', store);
      const service = new StorageService();
      service.set('profile', { a: 1 });
      foreign('nutritrack:diary');
      service.flush();
      expect(store.data.get('nutritrack:profile')).toBeUndefined();
      service.ngOnDestroy();
    });
  });
});
