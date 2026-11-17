import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DICTIONARY_SIZE,
  translateIngredientName,
  translateQueryWithDictionary,
} from './ingredient-dictionary';
import { normalizeTranslatedTexts } from './translate-normalize';
import { StorageService } from '../../storage/storage.service';
import { MAX_CACHED_TRANSLATIONS, TRANSLATION_CACHE_KEY, TranslationCache, hashTexts } from './translation-cache';

const SOURCE = { title: 'Soup', ingredients: ['a', 'b'], steps: ['x', 'y', 'z'] };

describe('ingredient dictionary', () => {
  it('has a broad word list', () => {
    expect(DICTIONARY_SIZE).toBeGreaterThanOrEqual(150);
  });

  it('maps ingredient names to German shopping base forms', () => {
    expect(translateIngredientName('pork shoulder')).toBe('Schweineschulter');
    expect(translateIngredientName('chopped fresh rosemary')).toBe('Rosmarin, frisch');
    expect(translateIngredientName('red lentils')).toBe('Rote Linsen');
    expect(translateIngredientName('onion')).toBe('Zwiebel');
  });

  it('keeps unknown names untouched', () => {
    expect(translateIngredientName(' Xyzfrucht ')).toBe('Xyzfrucht');
  });

  it('translates German search words to English where known', () => {
    expect(translateQueryWithDictionary('Hähnchen Reis')).toBe('chicken rice');
    expect(translateQueryWithDictionary('unbekannt')).toBe('unbekannt');
  });
});

describe('normalizeTranslatedTexts', () => {
  it('accepts a matching answer', () => {
    expect(normalizeTranslatedTexts({ title: ' Suppe ', ingredients: ['A', 'B'], steps: ['1', '2', '3'] }, SOURCE))
      .toEqual({ title: 'Suppe', ingredients: ['A', 'B'], steps: ['1', '2', '3'] });
  });

  it('falls back to the original for empty entries and an empty title', () => {
    expect(normalizeTranslatedTexts({ ingredients: ['A', ' '], steps: ['1', '2', '3'] }, SOURCE).ingredients).toEqual(['A', 'b']);
    expect(normalizeTranslatedTexts({ title: '', ingredients: ['A', 'B'], steps: ['1', '2', '3'] }, SOURCE).title).toBe('Soup');
  });

  it('accepts a missing steps field when the source has no steps (Prüfrunde 2)', () => {
    const source = { title: 'Soup', ingredients: ['a'], steps: [] };
    expect(normalizeTranslatedTexts({ title: 'Suppe', ingredients: ['A'] }, source).steps).toEqual([]);
    expect(() => normalizeTranslatedTexts({ title: 'Suppe', ingredients: ['A'] }, SOURCE)).toThrow();
  });

  it('rejects an answer with wrong line counts instead of passing the original off as translated (K3)', () => {
    expect(() => normalizeTranslatedTexts({ title: 'Suppe', ingredients: ['A'], steps: ['1', '2', '3'] }, SOURCE)).toThrow();
    expect(() => normalizeTranslatedTexts({ ingredients: ['A', 'B'], steps: [1, 2, 3] }, SOURCE)).toThrow();
    expect(() => normalizeTranslatedTexts(null, SOURCE)).toThrow();
  });

  it('accepts empty lists when the source has none', () => {
    const empty = { title: 'Soup', ingredients: [], steps: [] };
    expect(normalizeTranslatedTexts({ title: 'Suppe', ingredients: [], steps: [] }, empty).title).toBe('Suppe');
  });
});

describe('TranslationCache', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('stores and reads entries, misses on unknown keys', () => {
    const cache = TestBed.inject(TranslationCache);
    cache.set('k', SOURCE);
    expect(cache.get('k')).toEqual(SOURCE);
    expect(cache.get('other')).toBeNull();
  });

  it('is bounded and drops the oldest entries first', () => {
    const cache = TestBed.inject(TranslationCache);
    for (let i = 0; i < MAX_CACHED_TRANSLATIONS + 5; i++) cache.set(`de:${i}`, SOURCE);
    expect(cache.get('de:0')).toBeNull();
    expect(cache.get(`de:${MAX_CACHED_TRANSLATIONS + 4}`)).toEqual(SOURCE);
  });

  it('ignores stored entries whose elements are not strings (K12)', () => {
    localStorage.clear();
    const cache = TestBed.inject(TranslationCache);
    const storage = TestBed.inject(StorageService);
    storage.set(TRANSLATION_CACHE_KEY, { bad: { title: 'T', ingredients: [1, null], steps: ['x'] } });
    expect(cache.get('bad')).toBeNull();
  });

  it('hash changes with the text', () => {
    expect(hashTexts(SOURCE)).not.toBe(hashTexts({ ...SOURCE, title: 'Other' }));
    expect(hashTexts(SOURCE)).toBe(hashTexts({ ...SOURCE }));
  });

  it('clear removes everything', () => {
    const cache = TestBed.inject(TranslationCache);
    cache.set('k', SOURCE);
    cache.clear();
    expect(cache.get('k')).toBeNull();
  });
});
