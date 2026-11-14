import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StorageService } from '../storage/storage.service';
import { LEGACY_RECIPE_SEARCH_KEY, removeLegacyRecipeSearchConfig } from './legacy-storage-cleanup';

const PREFIXED = `nutritrack:${LEGACY_RECIPE_SEARCH_KEY}`;

describe('removeLegacyRecipeSearchConfig', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('löscht einen alten Eintrag mit eigenem Spoonacular-Key aus dem Gerätespeicher', () => {
    // Arrange
    localStorage.setItem(PREFIXED, JSON.stringify({ apiKey: 'geheim', baseUrl: 'https://api.spoonacular.com' }));
    const storage = TestBed.inject(StorageService);
    // Act
    removeLegacyRecipeSearchConfig(storage);
    // Assert
    expect(localStorage.getItem(PREFIXED)).toBeNull();
  });

  it('lässt andere Einträge unberührt und tut ohne alten Eintrag nichts', () => {
    // Arrange
    localStorage.setItem('nutritrack:profile', JSON.stringify({ weightKg: 70 }));
    const storage = TestBed.inject(StorageService);
    const before = localStorage.length;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Act
    removeLegacyRecipeSearchConfig(storage);
    // Assert
    expect(localStorage.getItem('nutritrack:profile')).toContain('70');
    expect(localStorage.length).toBe(before);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('meldet einen Fehler beim Löschen im Log statt ihn zu verschlucken', () => {
    // Arrange
    localStorage.setItem(PREFIXED, '{"apiKey":"k"}');
    const storage = TestBed.inject(StorageService);
    const failing = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Act
    removeLegacyRecipeSearchConfig(storage);
    // Assert
    expect(log).toHaveBeenCalled();
    failing.mockRestore();
    log.mockRestore();
  });
});
