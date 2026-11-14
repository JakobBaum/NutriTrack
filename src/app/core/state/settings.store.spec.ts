import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SettingsStore } from './settings.store';

const LEGACY = 'nutritrack:ai-config';

describe('SettingsStore Migration der KI-Verbindung', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('löscht beim Start einen gespeicherten eigenen Gemini-Key und die Server-Adresse', () => {
    // Arrange
    localStorage.setItem(LEGACY, JSON.stringify({ provider: 'gemini', apiKey: 'geheim', proxyUrl: 'https://x.test' }));
    // Act
    TestBed.inject(SettingsStore);
    // Assert
    expect(localStorage.getItem(LEGACY)).toBeNull();
  });
});
