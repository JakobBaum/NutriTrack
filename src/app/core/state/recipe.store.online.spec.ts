import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ONLINE_SOURCE } from '../recipes/online/online-recipe-ref';
import { StorageService } from '../storage/storage.service';
import { RecipeDraft, RecipeStore } from './recipe.store';

const onlineDraft = (externalId = '4242'): RecipeDraft => ({
  title: 'Linsensuppe',
  servings: 2,
  ingredients: [{ name: 'Linsen', amount: 200, unit: 'g' }],
  steps: ['Kochen'],
  origin: 'online',
  sourceUrl: 'https://blog.example/soup',
  imageUrl: 'https://img.example/x.jpg',
  factsPerServing: { kcal: 300, proteinG: 10, carbsG: 40, fatG: 5, basis: 'perPortion' },
  onlineRef: { source: ONLINE_SOURCE, externalId, savedAt: '2026-11-14T10:00:00.000Z' },
});

function persisted(): string {
  TestBed.inject(StorageService).flush();
  window.dispatchEvent(new Event('pagehide'));
  return localStorage.getItem('nutritrack:recipes') ?? '';
}

describe('RecipeStore Online-Verweise', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('legt ein Online-Rezept nur als Verweis ab: keine Zutaten, Schritte, Nährwerte', () => {
    const store = TestBed.inject(RecipeStore);

    const saved = store.add(onlineDraft());

    expect(saved.ingredients).toEqual([]);
    expect(saved.steps).toEqual([]);
    expect(saved.factsPerServing).toBeUndefined();
    const raw = persisted();
    expect(raw).toContain('"externalId":"4242"');
    expect(raw).toContain('Linsensuppe');
    expect(raw).not.toContain('Linsen"');
    expect(raw).not.toContain('Kochen');
    expect(raw).not.toContain('kcal');
  });

  it('macht beim Bearbeiten ein eigenes, vollständiges Rezept daraus (onlineRef entfällt)', () => {
    const store = TestBed.inject(RecipeStore);
    const saved = store.add(onlineDraft());

    store.update(saved.id, { ...onlineDraft(), title: 'Meine Suppe', onlineRef: undefined });

    const edited = store.get(saved.id);
    expect(edited?.onlineRef).toBeUndefined();
    expect(edited?.ingredients.length).toBe(1);
  });

  it('findet gespeicherte Verweise über die Anbieter-Id', () => {
    const store = TestBed.inject(RecipeStore);
    const saved = store.add(onlineDraft('77'));
    expect(store.findOnline('77')?.id).toBe(saved.id);
    expect(store.findOnline('78')).toBeUndefined();
  });

  it('reduziert beim Laden bereits vollständig gespeicherte Spoonacular-Rezepte einmalig auf den Verweis', () => {
    localStorage.setItem('nutritrack:recipes', JSON.stringify([{
      id: 'recipe_old', title: 'Alt', servings: 2, origin: 'online',
      ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }], steps: ['Garen'],
      sourceUrl: 'https://spoonacular.com/rice-bowl-555',
      factsPerServing: { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, basis: 'perPortion' },
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]));

    const store = TestBed.inject(RecipeStore);

    expect(store.get('recipe_old')?.onlineRef?.externalId).toBe('555');
    expect(store.get('recipe_old')?.ingredients).toEqual([]);
    const raw = persisted();
    expect(raw).not.toContain('Reis');
    expect(raw).not.toContain('Garen');

    TestBed.resetTestingModule();
    const again = TestBed.inject(RecipeStore);
    expect(again.recipes()).toEqual(store.recipes());
  });

  it('lässt eigene Rezepte beim Laden unverändert', () => {
    const own = {
      id: 'recipe_own', title: 'Eigen', servings: 2, origin: 'own',
      ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }], steps: ['Garen'],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    localStorage.setItem('nutritrack:recipes', JSON.stringify([own]));

    const store = TestBed.inject(RecipeStore);

    expect(store.get('recipe_own')).toEqual(own);
  });
});

describe('RecipeStore Umstellung alter Online-Rezepte: Sicherung und Id-Ableitung', () => {
  const legacy = {
    id: 'recipe_old', title: 'Alt', servings: 2, origin: 'online',
    ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }], steps: ['Garen'],
    sourceUrl: 'https://blog.example/rice', imageUrl: 'https://img.spoonacular.com/recipes/555-312x231.jpg',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('legt vor der Reduktion eine Auto-Sicherung mit den vollen Daten an', () => {
    localStorage.setItem('nutritrack:recipes', JSON.stringify([legacy]));

    const store = TestBed.inject(RecipeStore);
    TestBed.inject(StorageService).flush();

    expect(store.get('recipe_old')?.onlineRef?.externalId).toBe('555');
    const snapshot = localStorage.getItem('nutritrack:autosnapshot') ?? '';
    expect(snapshot).toContain('Reis');
    expect(snapshot).toContain('migration');
  });

  it('migriert nicht, wenn die Auto-Sicherung nicht geschrieben werden kann', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('nutritrack:recipes', JSON.stringify([legacy]));
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'nutritrack:autosnapshot') throw new DOMException('voll', 'QuotaExceededError');
      real.call(this, key, value);
    });

    const store = TestBed.inject(RecipeStore);

    expect(store.get('recipe_old')?.ingredients).toHaveLength(1);
    expect(store.get('recipe_old')?.onlineRef).toBeUndefined();
  });

  it('entfernt ein ungültiges onlineRef beim Laden', () => {
    localStorage.setItem('nutritrack:recipes', JSON.stringify([{ ...legacy, sourceUrl: undefined, imageUrl: undefined, onlineRef: null }]));
    const store = TestBed.inject(RecipeStore);
    expect(store.get('recipe_old')?.onlineRef).toBeUndefined();
    expect(store.get('recipe_old')?.ingredients).toHaveLength(1);
  });
});
