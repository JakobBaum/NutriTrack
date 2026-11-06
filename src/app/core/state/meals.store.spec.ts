import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MealsStore } from './meals.store';

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('MealsStore', () => {
  it('löscht gespeicherte Mahlzeiten und persistiert den leeren Stand bei clear()', () => {
    // Arrange
    const store = TestBed.inject(MealsStore);
    store.add({ name: 'Frühstück', entries: [] });
    expect(store.meals()).toHaveLength(1);

    // Act
    store.clear();

    // Assert
    expect(store.meals()).toHaveLength(0);
    TestBed.resetTestingModule();
    expect(TestBed.inject(MealsStore).meals()).toHaveLength(0);
  });
});
