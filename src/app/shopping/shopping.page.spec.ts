import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShoppingStore } from '../core/state/shopping.store';
import { ShoppingPage } from './shopping.page';

function createPage(): { page: ShoppingPage; store: ShoppingStore } {
  const store = TestBed.inject(ShoppingStore);
  const page = TestBed.runInInjectionContext(() => new ShoppingPage());
  return { page, store };
}

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient()] });
});

describe('ShoppingPage meal chips', () => {
  it('toggles a meal immutably', () => {
    // Arrange
    const { page } = createPage();
    const before = page.mealToggles();

    // Act
    page.toggleMeal('breakfast');

    // Assert
    const after = page.mealToggles();
    expect(after).not.toBe(before);
    expect(before.find((m) => m.value === 'breakfast')?.checked).toBe(false);
    expect(after.find((m) => m.value === 'breakfast')?.checked).toBe(true);
    expect(after.find((m) => m.value === 'lunch')?.checked).toBe(true);
  });

  it('toggles a meal off again', () => {
    const { page } = createPage();
    page.toggleMeal('lunch');
    expect(page.mealToggles().find((m) => m.value === 'lunch')?.checked).toBe(false);
  });
});

describe('ShoppingPage generator visibility', () => {
  it('shows the generator while there is no list', () => {
    const { page } = createPage();
    expect(page.showGenerator()).toBe(true);
  });

  it('collapses the generator once a list exists and reopens on request', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 500, unit: 'g', checked: false });
    expect(page.showGenerator()).toBe(false);

    page.openGenerator();
    expect(page.showGenerator()).toBe(true);

    page.closeGenerator();
    expect(page.showGenerator()).toBe(false);
  });

  it('collapses the generator after a successful generation', async () => {
    const { page } = createPage();
    await page.generate();
    expect(page.list()).not.toBeNull();
    expect(page.showGenerator()).toBe(false);
    expect(page.error()).toBeNull();
  });
});

describe('ShoppingPage checking items', () => {
  it('setChecked is idempotent for repeated events', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 500, unit: 'g', checked: false });

    page.setChecked(0, true);
    page.setChecked(0, true);

    expect(page.list()?.items[0].checked).toBe(true);

    page.setChecked(0, false);
    expect(page.list()?.items[0].checked).toBe(false);
  });

  it('ignores unknown indexes', () => {
    const { page } = createPage();
    expect(() => page.setChecked(3, true)).not.toThrow();
  });
});
