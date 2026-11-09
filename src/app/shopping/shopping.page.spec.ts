import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RecipeStore } from '../core/state/recipe.store';
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

describe('ShoppingPage add FAB', () => {
  it('opens and closes the add sheet', () => {
    const { page } = createPage();
    expect(page.addOpen()).toBe(false);
    page.openAdd();
    expect(page.addOpen()).toBe(true);
    page.closeAdd();
    expect(page.addOpen()).toBe(false);
  });

  it('uses 0.5 as initial breakpoint with a closing 0 breakpoint', () => {
    const { page } = createPage();
    expect(page.addBreakpoints[0]).toBe(0);
    expect(page.addBreakpoints).toContain(page.addInitialBreakpoint);
  });

  it('stores an optional price and clears all fields', () => {
    const { page, store } = createPage();
    page.newItemName = 'Käse';
    page.newItemPriceText = '2,49';
    page.addManual();
    expect(store.list()?.items.at(-1)?.userPrice).toBe(2.49);
    expect(page.newItemPriceText).toBe('');
    expect(page.newItemName).toBe('');
  });
});

describe('ShoppingPage manual add', () => {
  it('keeps a blank amount empty instead of defaulting to 1', () => {
    const { page, store } = createPage();
    page.newItemName = 'Salz';
    page.newItemAmountText = '';
    page.addManual();
    const item = store.list()?.items.at(-1);
    expect(item?.name).toBe('Salz');
    expect(item?.amount).toBe(0);
    expect(item?.unit).toBe('g');
  });

  it('parses a decimal comma amount', () => {
    const { page, store } = createPage();
    page.newItemName = 'Mehl';
    page.newItemAmountText = '0,5';
    page.newItemUnit = 'kg';
    page.addManual();
    const item = store.list()?.items.at(-1);
    expect(item?.amount).toBe(0.5);
    expect(item?.unit).toBe('kg');
    expect(page.newItemAmountText).toBe('');
  });
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

describe('ShoppingPage view switch', () => {
  it('defaults to the list view and hides the generator', () => {
    const { page } = createPage();
    expect(page.view()).toBe('list');
    expect(page.isListView()).toBe(true);
    expect(page.showGenerator()).toBe(false);
  });

  it('shows the generator only in the recipes view', () => {
    const { page } = createPage();
    page.setView('recipes');
    expect(page.showGenerator()).toBe(true);
    expect(page.isListView()).toBe(false);
    page.setView('list');
    expect(page.showGenerator()).toBe(false);
    expect(page.isListView()).toBe(true);
  });

  it('ignores unknown values from the segment', () => {
    const { page } = createPage();
    page.setView('recipes');
    page.onViewChange('bogus');
    expect(page.view()).toBe('recipes');
    page.onViewChange('list');
    expect(page.view()).toBe('list');
  });

  it('keeps an open undo delete until the list view is left, then commits it', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 500, unit: 'g', checked: false });
    store.addItem({ name: 'Nudeln', amount: 500, unit: 'g', checked: false });
    page.removeItem(0);
    expect(page.undoOpen()).toBe(true);
    expect(page.rows().map((r) => r.item.name)).toEqual(['Nudeln']);

    page.setView('recipes');
    expect(page.undoOpen()).toBe(false);
    expect(store.list()?.items.map((i) => i.name)).toEqual(['Nudeln']);
  });
});

describe('ShoppingPage generator visibility', () => {
  it('opens the generator on request and returns to the list on close', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 500, unit: 'g', checked: false });
    page.openGenerator();
    expect(page.view()).toBe('recipes');
    page.closeGenerator();
    expect(page.view()).toBe('list');
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
    TestBed.inject(RecipeStore).add({ title: 'Reis', servings: 1, steps: [], origin: 'own', ingredients: [{ name: 'Reis', amount: 100, unit: 'g' }] });
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

describe('ShoppingPage totals and undo delete', () => {
  it('excludes a pending delete from rows and total, and restores it on undo', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 1, unit: 'kg', checked: false, userPrice: 2 });
    store.addItem({ name: 'Brot', amount: 1, unit: 'Stk', checked: false, userPrice: 3 });

    page.removeItem(0);
    expect(page.rows().map((r) => r.item.name)).toEqual(['Brot']);
    expect(page.totals().total).toBe(3);
    expect(page.list()?.items).toHaveLength(2);

    page.onUndoDismiss({ detail: { role: 'undo' } } as CustomEvent<{ role?: string }>);
    expect(page.rows()).toHaveLength(2);
    expect(page.totals().total).toBe(5);
  });

  it('commits the delete when the toast ends without undo', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 1, unit: 'kg', checked: false });

    page.removeItem(0);
    page.onUndoDismiss({ detail: { role: 'timeout' } } as CustomEvent<{ role?: string }>);

    expect(page.list()?.items).toHaveLength(0);
  });

  it('rejects non-integer persons instead of flooring', async () => {
    const { page } = createPage();
    page.persons = 1.5;
    await page.generate();
    expect(page.error()).toContain('Personen');
    expect(page.list()).toBeNull();
  });
});

describe('ShoppingPage done section', () => {
  it('moves checked items out of the open groups into done rows', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 1, unit: 'kg', checked: false });
    store.addItem({ name: 'Brot', amount: 1, unit: 'Stk', checked: false });
    page.setChecked(0, true);

    expect(page.openGroups().flatMap((g) => g.rows.map((r) => r.item.name))).toEqual(['Brot']);
    expect(page.doneRows().map((r) => r.item.name)).toEqual(['Reis']);
    expect(page.doneOpen()).toBe(false);
    page.toggleDone();
    expect(page.doneOpen()).toBe(true);
  });

  it('removes all checked items with undo', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'A', amount: 1, unit: 'Stk', checked: true });
    store.addItem({ name: 'B', amount: 1, unit: 'Stk', checked: false });
    store.addItem({ name: 'C', amount: 1, unit: 'Stk', checked: true });

    page.removeChecked();
    expect(page.rows().map((r) => r.item.name)).toEqual(['B']);
    expect(page.undoMessage()).toBe('2 erledigte Positionen entfernt');

    page.onUndoDismiss({ detail: { role: 'undo' } } as CustomEvent<{ role?: string }>);
    expect(page.rows()).toHaveLength(3);
  });

  it('commits the bulk removal when the toast ends', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'A', amount: 1, unit: 'Stk', checked: true });
    store.addItem({ name: 'B', amount: 1, unit: 'Stk', checked: false });
    store.addItem({ name: 'C', amount: 1, unit: 'Stk', checked: true });

    page.removeChecked();
    page.onUndoDismiss({ detail: { role: 'timeout' } } as CustomEvent<{ role?: string }>);
    expect(store.list()?.items.map((i) => i.name)).toEqual(['B']);
  });

  it('adjusts a single delete while a bulk removal is pending', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'A', amount: 1, unit: 'Stk', checked: true });
    store.addItem({ name: 'B', amount: 1, unit: 'Stk', checked: false });
    store.addItem({ name: 'C', amount: 1, unit: 'Stk', checked: false });

    page.removeChecked();
    page.removeItem(2);
    expect(page.rows().map((r) => r.item.name)).toEqual(['B']);
    page.onUndoDismiss({ detail: { role: 'timeout' } } as CustomEvent<{ role?: string }>);
    expect(store.list()?.items.map((i) => i.name)).toEqual(['B']);
  });
});

describe('ShoppingPage share', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the Web Share API with the open items', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 500, unit: 'g', checked: false });

    await page.shareList();

    expect(share).toHaveBeenCalledWith({ title: 'Einkaufsliste', text: 'Einkaufsliste\n\nTrockenware/Nudeln/Reis:\n- Reis (500 g)' });
    expect(page.shareToastOpen()).toBe(false);
  });

  it('falls back to the clipboard and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 0, unit: 'g', checked: false });

    await page.shareList();

    expect(writeText).toHaveBeenCalledWith('Einkaufsliste\n\nTrockenware/Nudeln/Reis:\n- Reis');
    expect(page.shareToastOpen()).toBe(true);
    expect(page.shareToastMessage()).toContain('Zwischenablage');
  });

  it('does nothing when the user cancels the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('abort', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const { page, store } = createPage();
    store.addItem({ name: 'Reis', amount: 1, unit: 'kg', checked: false });

    await page.shareList();

    expect(writeText).not.toHaveBeenCalled();
    expect(page.shareToastOpen()).toBe(false);
  });
});

describe('ShoppingPage manual add sanity', () => {
  it('rejects a negative amount with a field error and keeps the input', () => {
    const { page, store } = createPage();
    page.newItemName = 'Salz';
    page.newItemAmountText = '-3';
    page.addManual();
    expect(store.list()).toBeNull();
    expect(page.addAmountError()).toBe('Zahl eingeben, z. B. 12,5');
    expect(page.newItemAmountText).toBe('-3');
  });

  it('rejects an unparsable price instead of silently dropping it', () => {
    const { page, store } = createPage();
    page.newItemName = 'Salz';
    page.newItemPriceText = 'abc';
    page.addManual();
    expect(store.list()).toBeNull();
    expect(page.addPriceError()).not.toBeNull();
  });

  it('stores an empty amount as "ohne Menge"', () => {
    const { page, store } = createPage();
    page.newItemName = 'Salz';
    page.addManual();
    expect(store.list()?.items.at(-1)?.amount).toBe(0);
    expect(page.addAmountError()).toBeNull();
  });

  it('ignores a blank name (Enter on empty field)', () => {
    const { page, store } = createPage();
    page.newItemName = '   ';
    page.addManual();
    expect(store.list()).toBeNull();
  });
});

describe('ShoppingPage ohne KI und Rezepte', () => {
  it('blockiert die Generierung und blendet Budget/Summe aus', () => {
    const { page } = createPage();
    expect(page.live()).toBe(false);
    expect(page.noRecipesBlock()).toBe(true);
    expect(page.showTotals()).toBe(false);
  });

  it('summiert eigene Preise vor Schätzungen', () => {
    const { page, store } = createPage();
    store.addItem({ name: 'Brot', amount: 1, unit: 'Stk', checked: false });
    store.addItem({ name: 'Milch', amount: 1, unit: 'l', checked: false });
    store.setItemPrice(0, 2.5);
    expect(page.showTotals()).toBe(true);
    expect(page.totals()).toMatchObject({ total: 4, unpriced: 0, priced: 2 });
  });
});
