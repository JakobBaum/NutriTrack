import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SettingsStore } from './settings.store';

function loadWithStored(model: string): SettingsStore {
  localStorage.clear();
  localStorage.setItem('nutritrack:ai-config', JSON.stringify({ provider: 'gemini', model, apiKey: 'k' }));
  TestBed.resetTestingModule();
  return TestBed.inject(SettingsStore);
}

describe('SettingsStore Modell-Migration', () => {
  beforeEach(() => localStorage.clear());

  it.each(['gemini-3.8-flash', 'gemini-3.8-pro'])('setzt %s auf den Standard zurück', (legacy) => {
    expect(loadWithStored(legacy).ai().model).toBe('');
  });

  it('lässt gültige Modelle und den Key unberührt', () => {
    const store = loadWithStored('gemini-3.5-flash-lite');
    expect(store.ai().model).toBe('gemini-3.5-flash-lite');
    expect(store.ai().apiKey).toBe('k');
  });
});
