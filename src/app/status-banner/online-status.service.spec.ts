import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { OnlineStatusService } from './online-status.service';

function setNavigatorOnline(value: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

describe('OnlineStatusService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('startet online, wenn der Browser online meldet', () => {
    setNavigatorOnline(true);
    expect(TestBed.inject(OnlineStatusService).isOffline()).toBe(false);
  });

  it('startet offline, wenn der Browser offline meldet', () => {
    setNavigatorOnline(false);
    expect(TestBed.inject(OnlineStatusService).isOffline()).toBe(true);
  });

  it('folgt den Ereignissen offline und online des Fensters', () => {
    setNavigatorOnline(true);
    const service = TestBed.inject(OnlineStatusService);
    window.dispatchEvent(new Event('offline'));
    expect(service.isOffline()).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(service.isOffline()).toBe(false);
  });

  it('entfernt beide Listener beim Zerstören', () => {
    setNavigatorOnline(true);
    const remove = vi.spyOn(window, 'removeEventListener');
    TestBed.inject(OnlineStatusService);
    TestBed.resetTestingModule();
    const types = remove.mock.calls.map(([type]) => type);
    expect(types).toContain('online');
    expect(types).toContain('offline');
  });

  it('reagiert nach dem Zerstören nicht mehr auf Ereignisse', () => {
    setNavigatorOnline(true);
    const service = TestBed.inject(OnlineStatusService);
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('offline'));
    expect(service.isOffline()).toBe(false);
  });
});
