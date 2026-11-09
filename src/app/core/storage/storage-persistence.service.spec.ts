import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoragePersistenceService } from './storage-persistence.service';

function stubStorage(storage: unknown): void {
  vi.stubGlobal('navigator', { storage });
}

describe('StoragePersistenceService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gilt als gewährt, wenn die API fehlt', async () => {
    stubStorage(undefined);
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBe(true);
    expect(service.denied()).toBe(false);
  });

  it('fragt nicht erneut, wenn bereits dauerhaft', async () => {
    const persist = vi.fn();
    stubStorage({ persisted: async () => true, persist });
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('merkt sich und loggt eine Ablehnung', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubStorage({ persisted: async () => false, persist: async () => false });
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBe(false);
    expect(service.denied()).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fängt Fehler ab, loggt sie und wirft nicht', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubStorage({
      persist: async () => {
        throw new Error('boom');
      },
    });
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBe(false);
    expect(service.denied()).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
