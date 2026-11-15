import { describe, expect, it } from 'vitest';
import { NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE, nativeClientHeaders, shouldMarkAsNativeClient } from './native-client-header';

const WORKER = 'https://w.test';

describe('shouldMarkAsNativeClient', () => {
  it('markiert native Aufrufe an den Worker', () => {
    expect(shouldMarkAsNativeClient(`${WORKER}/`, WORKER, true)).toBe(true);
    expect(shouldMarkAsNativeClient(`${WORKER}/off-search?q=milch`, WORKER, true)).toBe(true);
    expect(shouldMarkAsNativeClient(`${WORKER}/recipes/1/information`, WORKER, true)).toBe(true);
    expect(shouldMarkAsNativeClient(WORKER, WORKER, true)).toBe(true);
  });

  it('markiert keine nativen Aufrufe an fremde Adressen', () => {
    expect(shouldMarkAsNativeClient('https://other.test/', WORKER, true)).toBe(false);
    expect(shouldMarkAsNativeClient('https://w.test.evil.example/', WORKER, true)).toBe(false);
    expect(shouldMarkAsNativeClient('https://w.testing/', WORKER, true)).toBe(false);
    expect(shouldMarkAsNativeClient('/assets/x.json', WORKER, true)).toBe(false);
  });

  it('markiert im Browser nie, auch nicht für den Worker', () => {
    expect(shouldMarkAsNativeClient(`${WORKER}/`, WORKER, false)).toBe(false);
  });

  it('markiert nichts, wenn keine Worker-Adresse konfiguriert ist', () => {
    expect(shouldMarkAsNativeClient('https://w.test/', '', true)).toBe(false);
  });
});

describe('nativeClientHeaders', () => {
  it('liefert den Kennzeichen-Header ios', () => {
    expect(nativeClientHeaders()).toEqual({ [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE });
    expect(NATIVE_CLIENT_HEADER).toBe('X-NutriTrack-Client');
    expect(NATIVE_CLIENT_VALUE).toBe('ios');
  });
});
