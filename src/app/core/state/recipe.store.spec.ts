import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecipeDraft, RecipeStore } from './recipe.store';

const draft = (title: string): RecipeDraft => ({
  title,
  servings: 2,
  ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }],
  steps: [],
  origin: 'own',
});

describe('RecipeStore.update', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('aktualisiert das Rezept unter derselben id statt ein neues anzulegen', () => {
    // Arrange
    const store = TestBed.inject(RecipeStore);
    const created = store.add(draft('Alt'));

    // Act
    store.update(created.id, { ...draft('Neu'), servings: 4 });

    // Assert
    expect(store.recipes().length).toBe(1);
    const saved = store.get(created.id);
    expect(saved?.title).toBe('Neu');
    expect(saved?.servings).toBe(4);
    expect(saved?.createdAt).toBe(created.createdAt);
  });
});
