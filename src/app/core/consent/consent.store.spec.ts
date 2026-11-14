import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ConsentStore } from './consent.store';
import { CONSENT_KEY, CONSENT_VERSION } from './consent.model';

const KEY = `nutritrack:${CONSENT_KEY}`;

function freshStore(): ConsentStore {
  TestBed.resetTestingModule();
  return TestBed.inject(ConsentStore);
}

beforeEach(() => {
  localStorage.clear();
});

describe('ConsentStore', () => {
  it('startet ohne Zustimmung', () => {
    const store = freshStore();
    expect(store.granted()).toBe(false);
    expect(store.acceptedAt()).toBeNull();
  });

  it('speichert die Zustimmung und liest sie nach einem Neustart wieder', () => {
    const store = freshStore();
    expect(store.grant(new Date('2026-11-14T10:00:00.000Z'), true)).toBe(true);
    window.dispatchEvent(new Event('pagehide'));
    const reloaded = freshStore();
    expect(reloaded.granted()).toBe(true);
    expect(reloaded.acceptedAt()).toBe('2026-11-14T10:00:00.000Z');
  });

  it('verweigert die Zustimmung ohne bestätigte Volljährigkeit', () => {
    const store = freshStore();
    expect(store.grant(new Date(), false)).toBe(false);
    expect(store.granted()).toBe(false);
  });

  it('gilt bei veralteter Version im Speicher als keine Zustimmung', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION - 1, acceptedAt: '2026-11-14T10:00:00.000Z', isAdultConfirmed: true }));
    expect(freshStore().granted()).toBe(false);
  });

  it('gilt bei kaputtem JSON im Speicher als keine Zustimmung', () => {
    localStorage.setItem(KEY, '{kaputt');
    expect(freshStore().granted()).toBe(false);
  });

  it('widerruft die Zustimmung und entfernt den Eintrag', () => {
    const store = freshStore();
    store.grant(new Date(), true);
    store.revoke();
    window.dispatchEvent(new Event('pagehide'));
    expect(store.granted()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
