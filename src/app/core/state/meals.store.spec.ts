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

  it('update() behält id und Anlagedatum und erzeugt kein Duplikat', () => {
    // Arrange
    const store = TestBed.inject(MealsStore);
    const created = store.add({ name: 'Frühstück', entries: [] });

    // Act
    const updated = store.update(created.id, { name: '  Brunch ', entries: [] });

    // Assert
    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(store.meals()).toHaveLength(1);
    expect(store.meals()[0].name).toBe('Brunch');
  });

  it('update() liefert null für unbekannte id', () => {
    expect(TestBed.inject(MealsStore).update('nope', { name: 'x', entries: [] })).toBeNull();
  });
});
